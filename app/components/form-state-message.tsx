import { ErrorMessage, SuccessMessage } from "~/components/error";
import { useTranslation } from "~/i18n";

export interface FormState {
  success: boolean;
  message: string;
  /** Extra lines, e.g. what a SIGame import skipped. */
  details?: string[];
}

/** FormStateMessage shows the result of a form (e.g. an upload) with an
 * optional list of details below it. */
export function FormStateMessage({ formState }: { formState: FormState }) {
  const { t } = useTranslation();
  const details = formState.details ?? [];
  return (
    <div className="flex flex-col gap-2">
      {formState.success ? (
        <SuccessMessage>{formState.message}</SuccessMessage>
      ) : (
        <ErrorMessage>{formState.message}</ErrorMessage>
      )}
      {details.length > 0 ? (
        <div
          className="rounded-md bg-yellow-100 p-3 text-sm text-yellow-800"
          data-testid="form-state-details"
        >
          <p className="font-semibold">{t("common.skippedOrChanged")}</p>
          <ul className="list-disc pl-5 break-words">
            {details.map((detail, i) => (
              <li key={i}>{detail}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** hasDetails reports whether a form state carries details the user should
 * get time to read (so it isn't hidden automatically). */
export function hasDetails(formState: FormState | undefined): boolean {
  return (formState?.details?.length ?? 0) > 0;
}
