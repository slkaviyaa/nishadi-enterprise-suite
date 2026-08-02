export const dynamic = 'force-static'
import { Resend } from 'resend'

export async function POST(request) {
  // API Key එක Environment එකෙන් ගන්න
  const resend = new Resend(process.env.RESEND_API_KEY)
  
  const { to, subject, pdfBase64 } = await request.json()
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'Nishadi Motors <noreply@yourdomain.com>',
      to,
      subject,
      attachments: [{ filename: 'receipt.pdf', content: pdfBase64 }],
    })
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ success: true, data })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}