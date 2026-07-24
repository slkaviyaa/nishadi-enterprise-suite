import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const formData = await request.formData()
  const file = formData.get('file')

  if (!file) return Response.json({ error: 'No file' }, { status: 400 })

  const fileName = `receipt_${Date.now()}.pdf`
  const { error } = await supabaseAdmin.storage
    .from('receipts')
    .upload(fileName, file, { contentType: 'application/pdf', upsert: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage.from('receipts').getPublicUrl(fileName)

  return Response.json({ publicUrl })
}