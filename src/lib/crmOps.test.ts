// Covers NAME_UPDATE's per-provider tool-arg shape for the Sync names
// feature in CrmDuplicatesFuzzy. Each of the five CRMs takes a first/last
// name under a different casing and nesting; a typo/rename in any one
// silently sends the wrong JSON key to a live CRM with no test to catch
// it — previously 0% covered.
import { describe, it, expect } from "vitest";
import { NAME_UPDATE } from "./crmOps";

describe("NAME_UPDATE", () => {
  it("has an entry for every CRM provider that supports a contact-name sync", () => {
    expect(Object.keys(NAME_UPDATE).sort()).toEqual(
      ["hubspot", "outreach", "salesforce", "salesloft", "zoho"].sort(),
    );
  });

  it("hubspot: properties.firstname/lastname", () => {
    const [tool, args] = NAME_UPDATE.hubspot("123", "Ada", "Lovelace");
    expect(tool).toBe("hubspot_update_contact");
    expect(args).toEqual({ id: "123", properties: { firstname: "Ada", lastname: "Lovelace" } });
  });

  it("salesforce: data.FirstName/LastName", () => {
    const [tool, args] = NAME_UPDATE.salesforce("003", "Ada", "Lovelace");
    expect(tool).toBe("salesforce_update_contact");
    expect(args).toEqual({ id: "003", data: { FirstName: "Ada", LastName: "Lovelace" } });
  });

  it("zoho: data.First_Name/Last_Name", () => {
    const [tool, args] = NAME_UPDATE.zoho("1", "Ada", "Lovelace");
    expect(tool).toBe("zoho_update_contact");
    expect(args).toEqual({ id: "1", data: { First_Name: "Ada", Last_Name: "Lovelace" } });
  });

  it("outreach: attributes.firstName/lastName", () => {
    const [tool, args] = NAME_UPDATE.outreach("1", "Ada", "Lovelace");
    expect(tool).toBe("outreach_update_prospect");
    expect(args).toEqual({ id: "1", attributes: { firstName: "Ada", lastName: "Lovelace" } });
  });

  it("salesloft: data.first_name/last_name", () => {
    const [tool, args] = NAME_UPDATE.salesloft("1", "Ada", "Lovelace");
    expect(tool).toBe("salesloft_update_person");
    expect(args).toEqual({ id: "1", data: { first_name: "Ada", last_name: "Lovelace" } });
  });

  it("every mapper preserves the given id unchanged", () => {
    for (const provider of Object.keys(NAME_UPDATE)) {
      const [, args] = NAME_UPDATE[provider]("a-weird-id-123", "First", "Last");
      expect((args as { id: string }).id).toBe("a-weird-id-123");
    }
  });

  it("every mapper handles an empty last name (single-word name split)", () => {
    for (const provider of Object.keys(NAME_UPDATE)) {
      expect(() => NAME_UPDATE[provider]("1", "Cher", "")).not.toThrow();
    }
  });
});
