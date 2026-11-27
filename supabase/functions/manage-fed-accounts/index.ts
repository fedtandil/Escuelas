import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: request.headers.get("Authorization") ?? "" },
      },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: "No autorizado." }, 401);
    }

    if (authData.user.id !== "f7435bbd-5b4d-4296-b6ce-c24db1edad2e") {
      return json({ error: "Solo el administrador puede gestionar cuentas F.E.D." }, 403);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "list") {
      const { data: profiles, error } = await adminClient
        .from("profiles")
        .select("id,nombre,apellido,mail,role,created_at,updated_at")
        .eq("role", true)
        .order("nombre", { ascending: true });
      if (error) throw error;

      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      const emails = new Map<string, string>();
      authUsers?.users?.forEach((user) => {
        if (user.email) emails.set(user.id, user.email);
      });

      return json({
        accounts: (profiles ?? []).map((profile) => ({
          ...profile,
          email: emails.get(profile.id) ?? profile.mail,
        })),
      });
    }

    if (action === "create") {
      const nombre = String(body.nombre ?? "").trim();
      const apellido = String(body.apellido ?? "").trim();
      const mail = String(body.mail ?? body.email ?? "").trim().toLowerCase();
      const contraseña = String(body.contraseña ?? body.password ?? "");

      if (!nombre || !apellido || !contraseña || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        return json({ error: "Completá nombre, apellido, correo y contraseña." }, 400);
      }

      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("mail", mail)
        .maybeSingle();

      if (existingProfile) {
        return json({ error: "Ya existe una cuenta con ese correo." }, 409);
      }

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: mail,
        password: contraseña,
        email_confirm: true,
        user_metadata: {
          nombre,
          apellido,
          contraseña,
        },
      });

      if (createError) throw createError;
      if (!created.user) throw new Error("Supabase no devolvió el usuario creado.");

      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .upsert({
          id: created.user.id,
          nombre,
          apellido,
          mail,
          contraseña,
          role: true,
          created_at: created.user.created_at,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" })
        .select("*")
        .single();

      if (profileError) throw profileError;

      return json({ account: { ...profile, email: mail } });
    }

    if (action === "delete") {
      const userId = String(body.userId ?? "");
      if (!userId) return json({ error: "Falta el identificador de la cuenta." }, 400);

      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("id,role")
        .eq("id", userId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile || profile.role !== true) {
        return json({ error: "La cuenta F.E.D. no existe o ya fue eliminada." }, 404);
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;

      return json({ success: true });
    }

    return json({ error: "Acción no válida." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error interno." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
