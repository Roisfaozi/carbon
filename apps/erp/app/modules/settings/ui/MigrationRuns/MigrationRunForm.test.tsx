import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import MigrationRunForm from "./MigrationRunForm";

const { validatedFormSpy } = vi.hoisted(() => ({
  validatedFormSpy: vi.fn(({ children }: { children: React.ReactNode }) => (
    <form>{children}</form>
  ))
}));

vi.mock("@carbon/form", () => ({
  ValidatedForm: validatedFormSpy
}));

vi.mock("@carbon/react", () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
  HStack: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  VStack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("~/components/Form", () => ({
  Hidden: () => null,
  Input: () => null,
  Submit: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
  TextArea: () => null
}));

vi.mock("~/utils/path", () => ({
  path: {
    to: {
      newMigrationRun: "/x/settings/migration-runs/new"
    }
  }
}));

vi.mock("~/modules/settings", () => ({
  migrationRunRequestValidator: {}
}));

describe("MigrationRunForm", () => {
  it("passes string default values for JSON textareas", () => {
    renderToStaticMarkup(<MigrationRunForm />);

    const props = validatedFormSpy.mock.calls[0]?.[0] as any;
    expect(props).toBeDefined();
    expect(typeof props.defaultValues.profile).toBe("string");
    expect(typeof props.defaultValues.files).toBe("string");
  });
});
