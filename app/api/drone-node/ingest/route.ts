import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Drone = {
  id: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  rssi?: number;
};

type Payload = {
  node_id: string;
  lat: number;
  lon: number;
  drones: Drone[];
};

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function isValidPayload(body: unknown): body is Payload {
  if (!body || typeof body !== 'object') return false;

  const p = body as Record<string, unknown>;
  if (!isString(p.node_id)) return false;
  if (!isNumber(p.lat)) return false;
  if (!isNumber(p.lon)) return false;
  if (!Array.isArray(p.drones)) return false;

  for (const item of p.drones) {
    if (!item || typeof item !== 'object') return false;
    const d = item as Record<string, unknown>;
    if (!isString(d.id)) return false;

    if (d.name !== undefined && !isString(d.name)) return false;
    if (d.latitude !== undefined && !isNumber(d.latitude)) return false;
    if (d.longitude !== undefined && !isNumber(d.longitude)) return false;
    if (d.altitude !== undefined && !isNumber(d.altitude)) return false;
    if (d.speed !== undefined && !isNumber(d.speed)) return false;
    if (d.heading !== undefined && !isNumber(d.heading)) return false;
    if (d.rssi !== undefined && !isNumber(d.rssi)) return false;
  }

  return true;
}

export async function POST(req: NextRequest) {
  const expectedToken = process.env.DRONE_NODE_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: 'Server is missing DRONE_NODE_TOKEN' },
      { status: 500 }
    );
  }

  const authToken = parseBearerToken(req.headers.get('authorization'));
  if (!authToken || authToken !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  console.log('Drone node ingest:', JSON.stringify(body));

  // Replace this with a database insert, queue publish, or webhook forward.
  // Example:
  // await saveTelemetry(body);

  return new NextResponse(null, { status: 204 });
}
