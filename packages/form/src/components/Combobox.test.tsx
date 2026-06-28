import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Combobox from "./Combobox";

const { getInputProps, useField, useControlField, useFormStateContext } =
  vi.hoisted(() => ({
    getInputProps: vi.fn(() => ({
      name: "countryCode",
      defaultValue: "US"
    })),
    useField: vi.fn(() => ({
      getInputProps,
      error: undefined,
      isOptional: false
    })),
    useControlField: vi.fn(() => ["US", vi.fn()]),
    useFormStateContext: vi.fn(() => ({
      isReadOnly: false,
      isDisabled: false
    }))
  }));

vi.mock("../hooks", () => ({
  useField,
  useControlField
}));

vi.mock("../internal/formStateContext", () => ({
  useFormStateContext
}));

vi.mock("react-dom", () => ({
  flushSync: (fn: () => void) => fn()
}));

vi.mock("@carbon/react", () => ({
  Combobox: vi.fn(() => null),
  FormControl: ({ children }: { children: unknown }) => children,
  FormErrorMessage: ({ children }: { children: unknown }) => children,
  FormHelperText: ({ children }: { children: unknown }) => children,
  FormLabel: ({ children }: { children: unknown }) => children
}));

describe("Combobox hidden input", () => {
  it("does not warn about both value and defaultValue", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    renderToStaticMarkup(
      <Combobox
        name="countryCode"
        options={[{ value: "US", label: "United States" }]}
      />
    );

    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(
        "contains an input of type hidden with both value and defaultValue props"
      ),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );

    errorSpy.mockRestore();
  });
});
