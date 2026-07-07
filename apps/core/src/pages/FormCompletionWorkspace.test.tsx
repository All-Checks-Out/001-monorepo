import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProviderSubjects, listSubjectTypes } from "@frontend/api/onboarding/client";
import type {
  FormDocument,
  ProviderDDQChecklist,
  ProviderDDQChecklistTask,
} from "@frontend/api/onboarding/types";
import { FormCompletionWorkspace } from "./FormCompletionWorkspace";

vi.mock("@frontend/api/onboarding/client", () => ({
  listProviderSubjects: vi.fn(),
  listSubjectTypes: vi.fn(),
}));

describe("FormCompletionWorkspace", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSubjectTypes).mockResolvedValue({
      subjectTypes: [
        {
          key: "person",
          label: "Person",
          displayNameProperty: "name",
          properties: [
            { kind: "simple", key: "name", label: "Name", valueType: "text", required: true },
            { kind: "simple", key: "date_of_birth", label: "Date of birth", valueType: "date" },
          ],
        },
      ],
    });
    vi.mocked(listProviderSubjects).mockResolvedValue({
      subjects: [
        {
          id: 10,
          provider_corporation_id: 20,
          subject_type_key: "person",
          display_name: "Jane Doe",
          values_json: {
            name: "Jane Doe",
            date_of_birth: "1988-04-12",
          },
          archived_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("adds repeatable Subject entries and captures selected attributes", async () => {
    const onAutofill = vi.fn();

    render(
      <FormCompletionWorkspace
        document={subjectGroupDocument}
        values={{}}
        errors={{}}
        dirty={false}
        complete={false}
        canMutate
        busy={false}
        checklist={checklist}
        task={task}
        canPerformChecklist
        canReadSubjects
        onChange={vi.fn()}
        onAutofill={onAutofill}
        onReset={vi.fn()}
        onSave={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await waitFor(() => expect(listSubjectTypes).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Add Person" }));

    expect(onAutofill).toHaveBeenCalledWith({
      people: [{}],
    });

    cleanup();
    render(
      <FormCompletionWorkspace
        document={subjectGroupDocument}
        values={{ people: [{}] }}
        errors={{}}
        dirty={false}
        complete={false}
        canMutate
        busy={false}
        checklist={checklist}
        task={task}
        canPerformChecklist
        canReadSubjects
        onChange={vi.fn()}
        onAutofill={onAutofill}
        onReset={vi.fn()}
        onSave={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.change(await screen.findByLabelText(/Name/), {
      target: { value: "Jane Doe" },
    });

    expect(onAutofill).toHaveBeenLastCalledWith({
      people: [{ name: "Jane Doe" }],
    });
  });

  it("adds an existing provider Subject as a repeatable group entry", async () => {
    const onAutofill = vi.fn();

    render(
      <FormCompletionWorkspace
        document={subjectGroupDocument}
        values={{}}
        errors={{}}
        dirty={false}
        complete={false}
        canMutate
        busy={false}
        checklist={checklist}
        task={task}
        canPerformChecklist
        canReadSubjects
        onChange={vi.fn()}
        onAutofill={onAutofill}
        onReset={vi.fn()}
        onSave={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await waitFor(() => expect(listSubjectTypes).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Select existing" }));

    await waitFor(() =>
      expect(listProviderSubjects).toHaveBeenCalledWith({
        subjectTypeKey: "person",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add selected Person" }));

    expect(onAutofill).toHaveBeenCalledWith({
      people: [
        {
          name: "Jane Doe",
          date_of_birth: "1988-04-12",
        },
      ],
    });
  });
});

const subjectGroupDocument: FormDocument = {
  kind: "form-document",
  version: 1,
  definition: {
    title: "People details",
    items: [
      {
        id: "people",
        type: "subject",
        label: "People",
        required: true,
        subjectTypeKey: "person",
        repeatable: true,
        selectedProperties: [{ key: "name" }, { key: "date_of_birth" }],
      },
    ],
  },
  values: {},
};

const checklist: ProviderDDQChecklist = {
  id: 1,
  provider_ddq_pack_id: 2,
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const task: ProviderDDQChecklistTask = {
  id: 3,
  checklist_id: 1,
  ddq_pack_item_id: 4,
  status: "active",
  position: 1,
  kind: "ddq-task",
  task_type: "form-completion",
  title: "Complete people details",
  config: {},
  parent_branch_item_id: null,
  parent_branch_option_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};
