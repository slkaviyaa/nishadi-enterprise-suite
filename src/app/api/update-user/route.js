import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, password, email, data } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updateFields = {};
    if (password) updateFields.password = password;
    if (email) updateFields.email = email;
    if (data) updateFields.user_metadata = data;

    const { data: user, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updateFields
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}