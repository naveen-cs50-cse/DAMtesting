import { createHmac, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BODY_BYTES = 1_000_000
const MAX_INBOUND_TEXT_LENGTH = 4_000
const MAX_REPLY_LENGTH = 1_800

type Channel = 'whatsapp' | 'messenger' | 'instagram'

type InboundMessage = {
  channel: Channel
  accountId: string
  senderId: string
  messageId: string
  text: string | null
  phoneNumberId?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''

  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength)
}

function readOptionalText(value: unknown, maxLength: number) {
  const text = readText(value, maxLength)
  return text || null
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function graphVersion() {
  const configured = process.env.META_GRAPH_API_VERSION?.trim()
  return /^v\d+\.\d+$/.test(configured ?? '') ? configured! : 'v26.0'
}

function jsonResponse(value: Record<string, unknown>, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

function textResponse(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function parseWhatsAppMessages(payload: Record<string, unknown>): InboundMessage[] {
  const messages: InboundMessage[] = []
  const entries = Array.isArray(payload.entry) ? payload.entry : []

  for (const rawEntry of entries) {
    if (!isRecord(rawEntry)) continue
    const changes = Array.isArray(rawEntry.changes) ? rawEntry.changes : []

    for (const rawChange of changes) {
      if (!isRecord(rawChange) || rawChange.field !== 'messages' || !isRecord(rawChange.value)) continue

      const metadata = isRecord(rawChange.value.metadata) ? rawChange.value.metadata : {}
      const phoneNumberId = readOptionalText(metadata.phone_number_id, 128) ?? undefined
      const inbound = Array.isArray(rawChange.value.messages) ? rawChange.value.messages : []

      for (const rawMessage of inbound) {
        if (!isRecord(rawMessage)) continue
        const senderId = readOptionalText(rawMessage.from, 128)
        const messageId = readOptionalText(rawMessage.id, 256)
        if (!senderId || !messageId) continue

        const textPayload = isRecord(rawMessage.text) ? rawMessage.text : {}
        messages.push({
          channel: 'whatsapp',
          accountId: phoneNumberId ?? '',
          senderId,
          messageId,
          text: readOptionalText(textPayload.body, MAX_INBOUND_TEXT_LENGTH),
          phoneNumberId,
        })
      }
    }
  }

  return messages
}

function parseMessagingMessages(
  payload: Record<string, unknown>,
  channel: 'messenger' | 'instagram',
): InboundMessage[] {
  const messages: InboundMessage[] = []
  const entries = Array.isArray(payload.entry) ? payload.entry : []

  for (const rawEntry of entries) {
    if (!isRecord(rawEntry)) continue
    const accountId = readOptionalText(rawEntry.id, 128)
    const events = Array.isArray(rawEntry.messaging) ? rawEntry.messaging : []

    for (const rawEvent of events) {
      if (!isRecord(rawEvent) || !isRecord(rawEvent.sender) || !isRecord(rawEvent.message)) continue

      const senderId = readOptionalText(rawEvent.sender.id, 128)
      const messageId = readOptionalText(rawEvent.message.mid, 256)
      if (!accountId || !senderId || !messageId || rawEvent.message.is_echo === true) continue

      const textPayload = isRecord(rawEvent.message.text) ? rawEvent.message.text : {}
      messages.push({
        channel,
        accountId,
        senderId,
        messageId,
        text: readOptionalText(textPayload.body, MAX_INBOUND_TEXT_LENGTH),
      })
    }
  }

  return messages
}

function extractInboundMessages(payload: Record<string, unknown>) {
  const objectType = readOptionalText(payload.object, 100)

  if (objectType === 'whatsapp_business_account') return parseWhatsAppMessages(payload)
  if (objectType === 'page') return parseMessagingMessages(payload, 'messenger')
  if (objectType === 'instagram') return parseMessagingMessages(payload, 'instagram')

  return []
}

function formatForMessaging(text: string) {
  const cleaned = text
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned.slice(0, MAX_REPLY_LENGTH) || 'DAM could not complete the verification safely. Treat this claim as unverified.'
}

async function sendGraphMessage(
  endpoint: string,
  accessToken: string,
  body: Record<string, unknown>,
  channel: Channel,
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    console.error('[meta-webhook] reply delivery failed', {
      channel,
      status: response.status,
    })
    return false
  }

  console.info('[meta-webhook] reply delivery succeeded', { channel })
  return true
}

async function ensureWhatsAppBusinessAccountSubscription() {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim()
  const wabaId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID?.trim()

  if (!accessToken || !wabaId) {
    console.error('[meta-webhook] WhatsApp Business Account subscription skipped: configuration missing')
    return false
  }

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(wabaId)}/subscribed_apps`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    console.error('[meta-webhook] WhatsApp Business Account subscription failed', {
      status: response.status,
    })
    return false
  }

  console.info('[meta-webhook] WhatsApp Business Account subscription ensured')
  return true
}

async function sendChannelReply(message: InboundMessage, text: string) {
  const reply = formatForMessaging(text)

  if (message.channel === 'whatsapp') {
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim()
    const configuredPhoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim()
    const phoneNumberId = message.phoneNumberId ?? configuredPhoneNumberId

    if (
      !accessToken ||
      !phoneNumberId ||
      (configuredPhoneNumberId && message.phoneNumberId && message.phoneNumberId !== configuredPhoneNumberId)
    ) {
      console.error('[meta-webhook] WhatsApp reply skipped: configuration missing or mismatched')
      return false
    }

    return sendGraphMessage(
      `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(phoneNumberId)}/messages`,
      accessToken,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: message.senderId,
        type: 'text',
        text: { preview_url: false, body: reply },
      },
      message.channel,
    )
  }

  if (message.channel === 'messenger') {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim()
    const configuredPageId = process.env.META_PAGE_ID?.trim()

    if (!accessToken || (configuredPageId && configuredPageId !== message.accountId)) {
      console.error('[meta-webhook] Messenger reply skipped: configuration missing or mismatched')
      return false
    }

    return sendGraphMessage(
      `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(message.accountId)}/messages`,
      accessToken,
      {
        recipient: { id: message.senderId },
        messaging_type: 'RESPONSE',
        message: { text: reply },
      },
      message.channel,
    )
  }

  const accessToken = process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim()
  const configuredInstagramAccountId = process.env.META_INSTAGRAM_ACCOUNT_ID?.trim()

  if (!accessToken || (configuredInstagramAccountId && configuredInstagramAccountId !== message.accountId)) {
    console.error('[meta-webhook] Instagram reply skipped: configuration missing or mismatched')
    return false
  }

  return sendGraphMessage(
    `https://graph.instagram.com/${graphVersion()}/${encodeURIComponent(message.accountId)}/messages`,
    accessToken,
    {
      recipient: { id: message.senderId },
      message: { text: reply },
    },
    message.channel,
  )
}

async function readInvestigationStream(response: Response) {
  if (!response.ok || !response.body) {
    throw new Error(`DAM investigation request failed with status ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const rawEvent of events) {
      const eventType = rawEvent.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? 'message'
      const data = rawEvent.match(/^data:\s*(.+)$/m)?.[1]
      if (!data || eventType !== 'token') continue

      try {
        const parsed = JSON.parse(data) as { text?: unknown }
        if (typeof parsed.text === 'string') answer += parsed.text
      } catch {
        // Ignore malformed incremental data and preserve the valid stream output.
      }
    }
  }

  return answer
}

async function runDamInvestigation(message: InboundMessage, origin: string) {
  if (!message.text) {
    return 'DAM can currently verify text messages and links. Please send the claim as text, and do not share OTPs, passwords, PINs, or bank details.'
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 52_000)

  try {
    const response = await fetch(`${origin}/api/investigate/stream`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-dam-channel': message.channel,
      },
      body: JSON.stringify({
        prompt: message.text,
        attachments: [],
        lang: 'auto',
        history: [],
      }),
      signal: controller.signal,
      cache: 'no-store',
    })

    const answer = await readInvestigationStream(response)
    return answer || 'DAM could not complete the verification safely. Treat this claim as unverified.'
  } finally {
    clearTimeout(timer)
  }
}

async function processInboundMessage(message: InboundMessage, origin: string) {
  try {
    const reply = await runDamInvestigation(message, origin)
    await sendChannelReply(message, reply)
  } catch (error) {
    console.error('[meta-webhook] DAM investigation failed', {
      channel: message.channel,
      messageId: message.messageId,
      error: error instanceof Error ? error.name : 'unknown_error',
    })

    await sendChannelReply(
      message,
      'DAM could not complete the verification safely right now. Please retry shortly and treat the claim as unverified.',
    )
  }
}

export async function GET(request: Request) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim()
  if (!verifyToken) return textResponse('Webhook verification is not configured.', 503)

  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (!token || !challenge || mode !== 'subscribe' || !constantTimeEqual(token, verifyToken)) {
    return textResponse('Forbidden', 403)
  }

  return textResponse(challenge)
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET?.trim()
  if (!appSecret) {
    console.error('[meta-webhook] inbound rejected: app secret is not configured')
    return jsonResponse({ error: 'Webhook signature verification is not configured.' }, 503)
  }

  let rawBody = ''
  try {
    rawBody = await request.text()
  } catch {
    return jsonResponse({ error: 'Invalid webhook payload.' }, 400)
  }

  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Invalid webhook payload.' }, 400)
  }

  const signature = request.headers.get('x-hub-signature-256')
  const expectedSignature = `sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`

  if (!signature || !constantTimeEqual(signature, expectedSignature)) {
    console.error('[meta-webhook] inbound rejected: invalid signature')
    return jsonResponse({ error: 'Invalid webhook signature.' }, 401)
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ error: 'Invalid webhook payload.' }, 400)
  }

  if (!isRecord(payload)) return jsonResponse({ error: 'Invalid webhook payload.' }, 400)

  const messages = extractInboundMessages(payload).slice(0, 10)
  const origin = new URL(request.url).origin
  const isWhatsAppWebhook = payload.object === 'whatsapp_business_account'

  // Meta only forwards live WhatsApp events after the app is subscribed to its WABA.
  // This call is idempotent and uses the server-side token; it runs only after
  // Meta has authenticated a WhatsApp webhook.
  if (isWhatsAppWebhook) {
    after(() => ensureWhatsAppBusinessAccountSubscription())
  }

  for (const message of messages) {
    after(() => processInboundMessage(message, origin))
  }

  console.info('[meta-webhook] webhook accepted', {
    object: readOptionalText(payload.object, 100) ?? 'unknown',
    messageCount: messages.length,
  })

  return jsonResponse({ received: true })
}
