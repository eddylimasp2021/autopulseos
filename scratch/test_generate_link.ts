import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env" });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: users, error: errU } = await supabaseAdmin.auth.admin.listUsers();
  if (errU) {
    console.error("Error listing users:", errU);
    return;
  }
  
  if (users.users.length > 0) {
    const targetUser = users.users.find(u => u.email !== "eddylimainformatica@gmail.com") || users.users[0];
    console.log("Target user:", targetUser.email);
    
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.email!,
    });
    
    if (error) {
      console.error("Error generating link:", error);
    } else {
      console.log("Generated Link:", data.properties.action_link);
    }
  } else {
    console.log("No users found");
  }
}

test().catch(console.error);
