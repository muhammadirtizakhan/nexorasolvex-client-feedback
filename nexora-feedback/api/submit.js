// Vercel serverless function: POST /api/submit
// Env vars (Vercel > Settings > Environment Variables): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const crypto = require('crypto');

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // decoded size; browser downsizes before sending
const TEXT = {clientName:120, clientEmail:254, companyName:160, projectName:160, clientWebsite:300, servicePlan:20, serviceCategory:60, deploymentPlatform:60, otherPlatform:80, deploymentUrl:300, currency:3, deliveryDate:10, projectStatus:40, projectNotes:2000, detailedFeedback:2000, suggestions:2000};
const RATINGS = ['overallRating','designRating','performanceRating','communicationRating','deliveryRating'];

function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return {ext:'jpg', type:'image/jpeg'};
  if (buf.length > 12 && buf.slice(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return {ext:'png', type:'image/png'};
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return {ext:'webp', type:'image/webp'};
  return null;
}
function fail(res, code, msg) { return res.status(code).json({error: msg}); }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return fail(res, 403, 'Forbidden'); } catch { return fail(res, 403, 'Forbidden'); } }

  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); return fail(res, 500, 'Server is not configured'); }
  const headers = {apikey: key};
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (body.hp) return res.status(200).json({reference: 'NXF-OK', submittedAt: new Date().toISOString()}); // honeypot: pretend success
    const f = body.fields && typeof body.fields === 'object' ? body.fields : {};

    const data = {};
    for (const [k, max] of Object.entries(TEXT)) {
      const v = f[k] == null ? '' : String(f[k]).trim();
      if (v.length > max) return fail(res, 400, `${k} is too long`);
      data[k] = v;
    }
    for (const k of RATINGS) { const n = f[k]; data[k] = n == null ? null : Number(n); if (data[k] !== null && !(Number.isInteger(data[k]) && data[k] >= 1 && data[k] <= 5)) return fail(res, 400, 'Invalid rating'); }
    data.projectCost = f.projectCost == null || f.projectCost === '' ? null : Number(f.projectCost);
    if (data.projectCost !== null && !(Number.isFinite(data.projectCost) && data.projectCost >= 0 && data.projectCost < 1e12)) return fail(res, 400, 'Invalid cost');
    data.declarationAccepted = f.declarationAccepted === true;
    data.marketingConsent = f.marketingConsent === true;

    if (!data.clientName || !data.projectName || !data.detailedFeedback) return fail(res, 400, 'Required fields are missing');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.clientEmail)) return fail(res, 400, 'Invalid email');
    if (!data.declarationAccepted) return fail(res, 400, 'Declaration must be accepted');
    for (const k of ['clientWebsite','deploymentUrl']) if (data[k] && !/^https?:\/\/[^\s]+$/i.test(data[k])) return fail(res, 400, 'Invalid URL');
    if (data.deliveryDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.deliveryDate)) return fail(res, 400, 'Invalid date');
    if (data.currency && !['PKR','USD'].includes(data.currency)) return fail(res, 400, 'Invalid currency');
    if (data.servicePlan && !['Basic','Pro','Enterprise'].includes(data.servicePlan)) return fail(res, 400, 'Invalid plan');

    const id = crypto.randomUUID();
    const paths = {};
    for (const [field, name] of [['profile','profile'], ['signature','signature']]) {
      const b64 = body.images && body.images[field];
      if (!b64) continue;
      if (typeof b64 !== 'string' || b64.length > MAX_IMAGE_BYTES * 1.4) return fail(res, 400, 'Image too large');
      const buf = Buffer.from(b64, 'base64');
      const kind = sniff(buf);
      if (!kind || buf.length > MAX_IMAGE_BYTES || (name === 'signature' && kind.ext === 'webp')) return fail(res, 400, 'Unsupported image');
      const path = `${id}/${name}.${kind.ext}`;
      const up = await fetch(`${base}/storage/v1/object/feedback-uploads/${path}`, {method:'POST', headers:{...headers, 'Content-Type':kind.type, 'x-upsert':'false'}, body:buf});
      if (!up.ok) { console.error('upload', up.status, await up.text()); return fail(res, 502, 'Could not store image'); }
      paths[field] = path;
    }

    const rpc = await fetch(`${base}/rest/v1/rpc/submit_feedback`, {
      method:'POST', headers:{...headers, 'Content-Type':'application/json'},
      body: JSON.stringify({p_id:id, p_data:data, p_profile_path:paths.profile || null, p_signature_path:paths.signature || null})
    });
    if (!rpc.ok) { console.error('rpc', rpc.status, await rpc.text()); return fail(res, 502, 'Could not save feedback'); }
    const out = await rpc.json();
    return res.status(200).json({reference: out.reference, submittedAt: out.submitted_at});
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Unexpected error');
  }
};
