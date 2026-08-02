export const dynamic = 'force-static'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const branch_id = searchParams.get('branch_id')

  let query = supabase.from('petty_cash_ledger').select('*')
  if (branch_id) query = query.eq('branch_id', branch_id)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function POST(request) {
  const body = await request.json()
  const { data, error } = await supabase.from('petty_cash_ledger').insert(body).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function PUT(request) {
  const { id, ...updates } = await request.json()
  const { data, error } = await supabase.from('petty_cash_ledger').update(updates).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(request) {
  const { id } = await request.json()
  const { error } = await supabase.from('petty_cash_ledger').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true })
}