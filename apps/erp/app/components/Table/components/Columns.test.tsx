import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Columns from "./Columns";

const { drawerTriggerSpy, tooltipTriggerSpy } = vi.hoisted(() => ({
  drawerTriggerSpy: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  tooltipTriggerSpy: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ))
}));

vi.mock("@carbon/react", () => ({
  Drawer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerBody: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerTrigger: drawerTriggerSpy,
  HStack: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  IconButton: () => <button type="button">icon</button>,
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: tooltipTriggerSpy
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
  useLingui: () => ({
    t: (strings: TemplateStringsArray) => strings[0],
    i18n: { _: (value: string) => value }
  })
}));

vi.mock("framer-motion", () => ({
  Reorder: {
    Group: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Item: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  }
}));

describe("Columns trigger structure", () => {
  it("renders DrawerTrigger asChild to avoid nested buttons", () => {
    const columns = [
      {
        id: "name",
        getIsPinned: () => false,
        getIsVisible: () => true,
        pin: vi.fn(),
        toggleVisibility: vi.fn(),
        columnDef: {
          id: "name",
          header: "Name",
          meta: {}
        }
      }
    ];

    renderToStaticMarkup(
      <Columns
        columns={columns as any}
        columnOrder={["name"]}
        withSelectableRows={false}
        setColumnOrder={vi.fn()}
      />
    );

    const props = drawerTriggerSpy.mock.calls[0]?.[0] as any;
    expect(props.asChild).toBe(true);
  });
});
