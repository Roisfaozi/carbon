import {
  carbonCanonicalProfile,
  migrationRunRequestSchema
} from "@carbon/database/migration";
import { ValidatedForm } from "@carbon/form";
import { Button, HStack, VStack } from "@carbon/react";
import { Hidden, Input, Submit, TextArea } from "~/components/Form";
import { migrationRunRequestValidator } from "~/modules/settings";
import { path } from "~/utils/path";

type MigrationRunFormValues = {
  scenario: string;
  profile: string;
  files: string;
  filePathPrefix?: string;
};

type MigrationRunFormDefaultValues = {
  scenario: string;
  profile: typeof carbonCanonicalProfile;
  files: Record<string, string>;
  filePathPrefix?: string;
};

type MigrationRunFormProps = {
  onClose?: () => void;
};

const initialValues: MigrationRunFormValues = {
  scenario: carbonCanonicalProfile.id,
  profile: JSON.stringify(carbonCanonicalProfile, null, 2),
  files: "{}",
  filePathPrefix: "private/migration/carbon-canonical-v1"
};

const defaultValues: MigrationRunFormDefaultValues =
  migrationRunRequestSchema.parse({
    scenario: initialValues.scenario,
    profile: JSON.parse(initialValues.profile),
    files: JSON.parse(initialValues.files),
    filePathPrefix: initialValues.filePathPrefix
  });

const MigrationRunForm = ({ onClose }: MigrationRunFormProps) => {
  return (
    <ValidatedForm
      method="post"
      action={path.to.newMigrationRun}
      validator={migrationRunRequestValidator}
      defaultValues={defaultValues}
      className="w-full animate-in slide-in-from-right"
    >
      <VStack spacing={4} className="w-full">
        <Input name="scenario" label="Scenario" />
        <TextArea name="profile" label="Profile JSON" rows={18} />
        <TextArea name="files" label="Files JSON" rows={18} />
        <Input name="filePathPrefix" label="File Path Prefix" />
        <Hidden name="intent" value="create" />
        <HStack>
          <Submit>Queue Dry Run</Submit>
          {onClose && (
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          )}
        </HStack>
      </VStack>
    </ValidatedForm>
  );
};

export default MigrationRunForm;
