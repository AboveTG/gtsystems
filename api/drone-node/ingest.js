export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.DRONE_NODE_TOKEN;
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : '';

  if (!expected) {
    return res.status(500).json({ error: 'Missing DRONE_NODE_TOKEN' });
  }

  if (!token || token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body;

  if (
    !body ||
    typeof body !== 'object' ||
    typeof body.node_id !== 'string' ||
    typeof body.lat !== 'number' ||
    typeof body.lon !== 'number' ||
    !Array.isArray(body.drones)
  ) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  console.log('Drone ingest:', JSON.stringify(body));

  return res.status(204).end();
}
