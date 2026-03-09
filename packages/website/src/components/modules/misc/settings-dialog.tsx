import React, { type ComponentProps } from "react";

import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Box, Callout, Dialog, Flex, Heading, Text } from "@radix-ui/themes";
import { MetadataRegistry } from "@raideno/auto-form/registry";
import { AutoForm } from "@raideno/auto-form/ui";
import { z } from "zod/v4";

import { PasswordWithToggleController } from "@/components/controllers/password-with-toggle";
import { useGitHubAuth } from "@/hooks/github-auth";
import { toast } from "sonner";
import { useModals } from "@/contexts/dialogs";

interface SettingsDialogProps {
}

const SettingsFormSchema = z.object({
  token: z.string().register(MetadataRegistry, {
    type: "password",
    placeholder: "ghp_xxxxxxxxxxxxxxxxxxxx",
    label: "GitHub Personal Access Token",
    description:
      "Required for editing and pushing changes. Token is automatically saved.",
    controller: PasswordWithToggleController as any,
  }),
});

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
}) => {
  const githubAuth = useGitHubAuth();
  const { isOpen: open, setOpen: onOpenChange } = useModals("settings");

  const handleSubmit: ComponentProps<
    typeof AutoForm.Root<typeof SettingsFormSchema>
  >["onSubmit"] = (data, tag, _helpers) => {
    if (tag === "submit") {
      githubAuth.setToken(data.token.trim());
      toast.success("Token saved successfully");
      onOpenChange(false);
    } else {
      toast.error("Please fix the errors in the form before submitting.");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <AutoForm.Root
          defaultValues={{
            token: githubAuth.token || "",
          }}
          schema={SettingsFormSchema}
          onSubmit={handleSubmit}
        >
          <Flex direction="column" gap="4">
            <Box>
              <>
                <Dialog.Title className="sr-only">Settings</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Manage your GitHub authentication and preferences
                </Dialog.Description>
              </>
              <Heading>Settings</Heading>
              <Text>Manage your GitHub authentication and preferences</Text>
            </Box>

            <AutoForm.Content />

            <Callout.Root color="blue" variant="soft">
              <Callout.Icon>
                <InfoCircledIcon />
              </Callout.Icon>
              <Callout.Text>
                You'll need a GitHub personal access token with repository write
                permissions.{" "}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "underline" }}
                >
                  Create one here
                </a>
                .
              </Callout.Text>
            </Callout.Root>
            <AutoForm.Actions>
              <AutoForm.Action
                tag="submit"
                className="w-full"
                variant="classic"
              >
                Save
              </AutoForm.Action>
            </AutoForm.Actions>
          </Flex>
        </AutoForm.Root>
      </Dialog.Content>
    </Dialog.Root>
  );
};
