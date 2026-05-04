import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  console.log("Starting migration of private bucket to company-specific buckets...");

  // 1. Get all companies
  const { data: companies, error: companiesError } = await supabase
    .from("company")
    .select("id");

  if (companiesError || !companies) {
    console.error("Failed to fetch companies:", companiesError);
    process.exit(1);
  }

  for (const company of companies) {
    const companyId = company.id;
    console.log(`\nProcessing company: ${companyId}`);

    // Create the bucket if it doesn't exist
    const { error: bucketError } = await supabase.storage.createBucket(companyId, {
      public: false,
      fileSizeLimit: 52428800, // 50MB
    });

    if (bucketError && !bucketError.message.includes("already exists")) {
      console.error(`Failed to create bucket ${companyId}:`, bucketError);
      continue;
    }

    // Since Supabase storage list is limited and requires recursion for folders,
    // we'll implement a simple recursive list.
    async function listAndMoveAll(pathPrefix: string) {
      const { data: list, error: listError } = await supabase.storage
        .from("private")
        .list(pathPrefix);

      if (listError || !list) {
        console.error(`Failed to list ${pathPrefix}:`, listError);
        return;
      }

      for (const item of list) {
        // Skip hidden files like .emptyFolderPlaceholder
        if (item.name.startsWith(".")) continue;

        const itemPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name;

        if (item.id === null) {
          // It's a folder, recurse
          await listAndMoveAll(itemPath);
        } else {
          // It's a file, move it
          console.log(`Copying ${itemPath} -> bucket: ${companyId}, path: ${itemPath}`);
          
          // Download from old bucket
          const { data: fileData, error: downloadError } = await supabase.storage
            .from("private")
            .download(itemPath);

          if (downloadError) {
            console.error(`Failed to download ${itemPath}:`, downloadError);
            continue;
          }

          // Upload to new bucket
          const { error: uploadError } = await supabase.storage
            .from(companyId)
            .upload(itemPath, fileData, {
              upsert: true,
            });

          if (uploadError) {
            console.error(`Failed to upload ${itemPath} to ${companyId}:`, uploadError);
          } else {
            console.log(`Successfully migrated ${itemPath}`);
          }
        }
      }
    }

    // Start recursive listing and moving at the companyId root folder in 'private' bucket
    await listAndMoveAll(companyId);
  }

  console.log("\nMigration completed.");
}

migrate().catch(console.error);
