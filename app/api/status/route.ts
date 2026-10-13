import net from "node:net"
import dns from "node:dns/promises"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HOST = "evilverse.tkmc.net"
const CACHE_TTL_MS = 4000
const PING_TIMEOUT_MS = 4000

type ServerStatus = {
  online: boolean
  players: { online: number; max: number }
  version: string
  source: "ping" | "mcstatus" | "none"
  checkedAt: number
}

let cache: { at: number; data: ServerStatus } | null = null
let inflight: Promise<ServerStatus> | null = null

function writeVarInt(value: number): Buffer {
  const bytes: number[] = []
  let v = value >>> 0
  do {
    let byte = v & 0x7f
    v >>>= 7
    if (v !== 0) byte |= 0x80
    bytes.push(byte)
  } while (v !== 0)
  return Buffer.from(bytes)
}

function readVarInt(buf: Buffer, offset: number): { value: number; size: number } | null {
  let value = 0
  let size = 0
  while (true) {
    if (offset + size >= buf.length) return null
    const byte = buf[offset + size]
    value |= (byte & 0x7f) << (7 * size)
    size++
    if ((byte & 0x80) === 0) break
    if (size > 5) throw new Error("VarInt too long")
  }
  return { value, size }
}

function packet(payload: Buffer): Buffer {
  return Buffer.concat([writeVarInt(payload.length), payload])
}

async function resolveTarget(host: string): Promise<{ host: string; port: number }> {
  try {
    const records = await dns.resolveSrv(`_minecraft._tcp.${host}`)
    if (records.length) {
      records.sort((a, b) => a.priority - b.priority || b.weight - a.weight)
      return { host: records[0].name, port: records[0].port }
    }
  } catch {
    // no SRV record, fall back to the default port
  }
  return { host, port: 25565 }
}

function slp(host: string, port: number, originalHost: string): Promise<Omit<ServerStatus, "source" | "checkedAt">> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    let received = Buffer.alloc(0)
    let settled = false

    const finish = (err: Error | null, value?: Omit<ServerStatus, "source" | "checkedAt">) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (err) reject(err)
      else resolve(value!)
    }

    socket.setTimeout(PING_TIMEOUT_MS, () => finish(new Error("timeout")))
    socket.on("error", (e) => finish(e))

    socket.on("connect", () => {
      const hostBuf = Buffer.from(originalHost, "utf8")
      const portBuf = Buffer.alloc(2)
      portBuf.writeUInt16BE(port)
      const handshake = Buffer.concat([
        writeVarInt(0x00),
        writeVarInt(765),
        writeVarInt(hostBuf.length),
        hostBuf,
        portBuf,
        writeVarInt(1),
      ])
      socket.write(Buffer.concat([packet(handshake), packet(writeVarInt(0x00))]))
    })

    socket.on("data", (chunk) => {
      received = Buffer.concat([received, chunk])
      try {
        const len = readVarInt(received, 0)
        if (!len || received.length < len.size + len.value) return
        const packetId = readVarInt(received, len.size)
        if (!packetId) return
        const strLen = readVarInt(received, len.size + packetId.size)
        if (!strLen) return
        const start = len.size + packetId.size + strLen.size
        if (received.length < start + strLen.value) return
        const json = JSON.parse(received.subarray(start, start + strLen.value).toString("utf8"))
        const versionName = String(json?.version?.name ?? "")
        finish(null, {
          online: true,
          players: { online: Number(json?.players?.online ?? 0), max: Number(json?.players?.max ?? 0) },
          version: versionName.replace(/§./g, ""),
        })
      } catch (e) {
        finish(e instanceof Error ? e : new Error("bad response"))
      }
    })
  })
}

async function viaMcStatus(host: string): Promise<ServerStatus> {
  const res = await fetch(`https://api.mcstatus.io/v2/status/java/${host}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  })
  const d = await res.json()
  return {
    online: Boolean(d.online),
    players: { online: Number(d.players?.online ?? 0), max: Number(d.players?.max ?? 0) },
    version: String(d.version?.name_clean ?? ""),
    source: "mcstatus",
    checkedAt: Date.now(),
  }
}

async function fetchStatus(): Promise<ServerStatus> {
  try {
    const target = await resolveTarget(HOST)
    const result = await slp(target.host, target.port, HOST)
    return { ...result, source: "ping", checkedAt: Date.now() }
  } catch {
    try {
      return await viaMcStatus(HOST)
    } catch {
      return {
        online: false,
        players: { online: 0, max: 0 },
        version: "",
        source: "none",
        checkedAt: Date.now(),
      }
    }
  }
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return Response.json(cache.data, { headers: { "Cache-Control": "no-store" } })
  }
  inflight ??= fetchStatus().finally(() => {
    inflight = null
  })
  const data = await inflight
  cache = { at: Date.now(), data }
  return Response.json(data, { headers: { "Cache-Control": "no-store" } })
}
