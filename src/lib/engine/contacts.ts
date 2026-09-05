/**
 * Contact Picker API integration.
 * Works on Android Chrome (and some other browsers).
 * Falls back gracefully when unavailable.
 */

export interface PickedContact {
  name: string;
  phone?: string;
  email?: string;
}

// Extend navigator type for Contact Picker API
interface ContactPickerNavigator extends Navigator {
  contacts?: {
    select: (
      properties: string[],
      options?: { multiple?: boolean }
    ) => Promise<Array<{ name?: string[]; tel?: string[]; email?: string[] }>>;
    getProperties: () => Promise<string[]>;
  };
}

export function isContactPickerSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "contacts" in navigator && "ContactsManager" in window;
}

export async function pickContacts(multiple = true): Promise<PickedContact[]> {
  const nav = navigator as ContactPickerNavigator;

  if (!nav.contacts) {
    throw new Error("Contact Picker API not supported in this browser. Try Chrome on Android.");
  }

  try {
    // Check available properties
    const props = await nav.contacts.getProperties();
    const requestProps = ["name"];
    if (props.includes("tel")) requestProps.push("tel");
    if (props.includes("email")) requestProps.push("email");

    const contacts = await nav.contacts.select(requestProps, { multiple });

    return contacts
      .filter((c) => c.name && c.name.length > 0)
      .map((c) => ({
        name: c.name?.[0] || "Unknown",
        phone: c.tel?.[0],
        email: c.email?.[0],
      }));
  } catch (err) {
    // User cancelled the picker
    if (err instanceof DOMException && err.name === "InvalidStateError") {
      return [];
    }
    throw err;
  }
}
