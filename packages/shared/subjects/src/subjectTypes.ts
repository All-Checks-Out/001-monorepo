export type SubjectSimplePropertyType =
  | "text"
  | "long_text"
  | "date"
  | "number"
  | "boolean"
  | "email"
  | "phone"
  | "currency"
  | "select";

export type SubjectPropertyBase = {
  key: string;
  label: string;
  helpText?: string;
  required?: boolean;
};

export type SubjectSimplePropertyDefinition = SubjectPropertyBase & {
  kind: "simple";
  valueType: SubjectSimplePropertyType;
  options?: readonly string[];
};

export type SubjectComplexPropertyDefinition = SubjectPropertyBase & {
  kind: "complex";
  repeatable: true;
  display: "table";
  properties: readonly SubjectSimplePropertyDefinition[];
};

export type SubjectPropertyDefinition =
  | SubjectSimplePropertyDefinition
  | SubjectComplexPropertyDefinition;

export type SubjectTypeDefinition = {
  key: string;
  label: string;
  description?: string;
  displayNameProperty: string;
  properties: readonly SubjectPropertyDefinition[];
};

const genderOptions = ["female", "male", "non-binary", "prefer-not-to-say"] as const;
const membershipStatusOptions = ["active", "expired", "suspended", "cancelled"] as const;
const documentPrimaryTypeOptions = [
  "passport",
  "driving-license",
  "certificate",
  "membership-card",
  "other",
] as const;
const vehicleTypeOptions = ["car", "van", "motorcycle", "hgv", "other"] as const;

export const SUBJECT_TYPES = [
  {
    key: "person",
    label: "Person",
    description: "A person the provider can collect information about.",
    displayNameProperty: "name",
    properties: [
      { kind: "simple", key: "name", label: "Name", valueType: "text", required: true },
      { kind: "simple", key: "date_of_birth", label: "Date of birth", valueType: "date" },
      {
        kind: "simple",
        key: "gender",
        label: "Gender",
        valueType: "select",
        options: genderOptions,
      },
      { kind: "simple", key: "nationality", label: "Nationality", valueType: "text" },
      {
        kind: "complex",
        key: "directorships",
        label: "Directorships",
        repeatable: true,
        display: "table",
        properties: [
          { kind: "simple", key: "company", label: "Company", valueType: "text" },
          { kind: "simple", key: "role", label: "Role", valueType: "text" },
          { kind: "simple", key: "date_started", label: "Date started", valueType: "date" },
          { kind: "simple", key: "date_left", label: "Date left", valueType: "date" },
        ],
      },
      {
        kind: "complex",
        key: "employments",
        label: "Employments",
        repeatable: true,
        display: "table",
        properties: [
          { kind: "simple", key: "employer", label: "Employer", valueType: "text" },
          { kind: "simple", key: "role", label: "Role", valueType: "text" },
          { kind: "simple", key: "date_started", label: "Date started", valueType: "date" },
          { kind: "simple", key: "date_left", label: "Date left", valueType: "date" },
        ],
      },
      {
        kind: "complex",
        key: "qualifications",
        label: "Qualifications",
        repeatable: true,
        display: "table",
        properties: [
          { kind: "simple", key: "qualification", label: "Qualification", valueType: "text" },
          { kind: "simple", key: "grade", label: "Grade", valueType: "text" },
          { kind: "simple", key: "issuing_body", label: "Issuing body", valueType: "text" },
          { kind: "simple", key: "date_awarded", label: "Date awarded", valueType: "date" },
        ],
      },
      {
        kind: "complex",
        key: "memberships",
        label: "Memberships",
        repeatable: true,
        display: "table",
        properties: [
          { kind: "simple", key: "association", label: "Association", valueType: "text" },
          {
            kind: "simple",
            key: "membership_type",
            label: "Membership type",
            valueType: "text",
          },
          {
            kind: "simple",
            key: "status",
            label: "Status",
            valueType: "select",
            options: membershipStatusOptions,
          },
        ],
      },
    ],
  },
  {
    key: "organisation",
    label: "Organisation",
    description: "An organisation or business entity.",
    displayNameProperty: "name",
    properties: [
      { kind: "simple", key: "name", label: "Name", valueType: "text", required: true },
      { kind: "simple", key: "registration_number", label: "Registration number", valueType: "text" },
      { kind: "simple", key: "country", label: "Country", valueType: "text" },
    ],
  },
  {
    key: "document",
    label: "Document",
    description: "A document or credential.",
    displayNameProperty: "reference_number",
    properties: [
      {
        kind: "simple",
        key: "primary_type",
        label: "Primary type",
        valueType: "select",
        required: true,
        options: documentPrimaryTypeOptions,
      },
      { kind: "simple", key: "secondary_type", label: "Secondary type", valueType: "text" },
      { kind: "simple", key: "issuing_body", label: "Issuing body", valueType: "text" },
      { kind: "simple", key: "issue_date", label: "Issue date", valueType: "date" },
      { kind: "simple", key: "expiry_date", label: "Expiry date", valueType: "date" },
      { kind: "simple", key: "reference_number", label: "Reference number", valueType: "text" },
    ],
  },
  {
    key: "property",
    label: "Property",
    description: "A real-world property or location.",
    displayNameProperty: "address_line_1",
    properties: [
      { kind: "simple", key: "address_line_1", label: "Address line 1", valueType: "text", required: true },
      { kind: "simple", key: "address_line_2", label: "Address line 2", valueType: "text" },
      { kind: "simple", key: "city", label: "City", valueType: "text" },
      { kind: "simple", key: "postcode", label: "Postcode", valueType: "text" },
      { kind: "simple", key: "country", label: "Country", valueType: "text" },
    ],
  },
  {
    key: "vehicle",
    label: "Vehicle",
    description: "A vehicle.",
    displayNameProperty: "registration_number",
    properties: [
      {
        kind: "simple",
        key: "registration_number",
        label: "Registration number",
        valueType: "text",
        required: true,
      },
      { kind: "simple", key: "vehicle_type", label: "Vehicle type", valueType: "select", options: vehicleTypeOptions },
      { kind: "simple", key: "make", label: "Make", valueType: "text" },
      { kind: "simple", key: "model", label: "Model", valueType: "text" },
    ],
  },
  {
    key: "business_event",
    label: "Business Event",
    description: "A relevant event connected to a business or organisation.",
    displayNameProperty: "event_type",
    properties: [
      { kind: "simple", key: "event_type", label: "Event type", valueType: "text", required: true },
      { kind: "simple", key: "event_date", label: "Event date", valueType: "date" },
      {
        kind: "simple",
        key: "related_organisation",
        label: "Related organisation",
        valueType: "text",
      },
    ],
  },
] as const satisfies readonly SubjectTypeDefinition[];

export type SubjectTypeKey = (typeof SUBJECT_TYPES)[number]["key"];

export function getSubjectTypes(): readonly SubjectTypeDefinition[] {
  return SUBJECT_TYPES;
}

export function getSubjectTypeDefinition(
  subjectTypeKey: string,
): SubjectTypeDefinition | null {
  return SUBJECT_TYPES.find((type) => type.key === subjectTypeKey) ?? null;
}

export function getSubjectPropertyDefinition(
  subjectTypeKey: string,
  propertyKey: string,
): SubjectPropertyDefinition | null {
  return (
    getSubjectTypeDefinition(subjectTypeKey)?.properties.find(
      (property) => property.key === propertyKey,
    ) ?? null
  );
}

export function getSubjectComplexPropertyColumnDefinition(
  subjectTypeKey: string,
  propertyKey: string,
  columnKey: string,
): SubjectSimplePropertyDefinition | null {
  const property = getSubjectPropertyDefinition(subjectTypeKey, propertyKey);
  if (!property || property.kind !== "complex") return null;

  return property.properties.find((column) => column.key === columnKey) ?? null;
}
