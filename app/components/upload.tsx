import clsx from "clsx";
import * as React from "react";
import { useDropzone } from "react-dropzone";
import type { FetcherWithComponents } from "react-router";
import { useSubmit } from "react-router";

import Button from "~/components/button";
import Dialog from "~/components/dialog";
import { WarningMessage } from "~/components/error";
import {
  DocumentArrowUp,
  ExclamationTriangle,
  LoadingSpinner,
} from "~/components/icons";
import Link from "~/components/link";
import { useTranslation } from "~/i18n";

/** Files the upload accepts: Jep! games and SIGame packs. Browsers report
 * .siq files as zip, octet-stream or nothing; the server checks the name. */
const ACCEPT_INPUT = [
  ".jep.json",
  ".json",
  "application/json",
  ".siq",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
].join(",");

export function isSiqFile(file?: { name: string }) {
  return file?.name.toLowerCase().endsWith(".siq") ?? false;
}

function UploadBox({
  loading,
  loadingText,
  onChange,
}: {
  loading: boolean;
  loadingText: string;
  onChange: (file?: File) => void;
}) {
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file || !inputRef.current) return;

      // Set the file on the native input so form serialization works
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      inputRef.current.files = dataTransfer.files;

      onChange(file);
    },
    [onChange],
  );

  const { getRootProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      "application/json": [".jep.json", ".json"],
      "application/zip": [".siq"],
    },
    multiple: false,
    disabled: loading,
    noClick: true,
  });

  const uploadText = t("upload.uploadOrImport");
  const invalidText = t("upload.invalidFileType");
  let label = loading ? loadingText : uploadText;
  if (isDragActive) {
    label = isDragReject ? invalidText : t("upload.dropFileHere");
  }

  return (
    <div className="my-2 flex flex-col items-center">
      <button
        {...getRootProps({ role: "button" })}
        id="upload-button"
        type="button"
        onClick={() => inputRef.current?.click()}
        className={clsx(
          `flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-sm text-ink-900 shadow-sm transition-colors focus:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-page focus:outline-none`,
          {
            "border-green-500 bg-green-50 dark:bg-green-950/40":
              isDragActive && !isDragReject,
            "border-red-500 bg-red-50 dark:bg-red-950/40": isDragReject,
            "border-blue-600 hover:border-blue-700 hover:shadow-md dark:border-accent dark:hover:border-accent-strong":
              !isDragActive,
          },
        )}
      >
        {loading ? (
          <LoadingSpinner className="mb-2" />
        ) : (
          <DocumentArrowUp className="mb-2 h-5 w-5" />
        )}
        <p className="grid text-center">
          <span className="col-start-1 row-start-1">{label}</span>
          <span
            className="invisible col-start-1 row-start-1"
            aria-hidden="true"
          >
            {uploadText}
          </span>
          <span
            className="invisible col-start-1 row-start-1"
            aria-hidden="true"
          >
            {invalidText}
          </span>
        </p>
        <input
          id="upload"
          type="file"
          disabled={loading}
          accept={ACCEPT_INPUT}
          name="upload"
          aria-describedby="upload_help"
          className="hidden"
          ref={inputRef}
          onChange={(e) => onChange(e.target.files?.[0])}
        />
      </button>
      <p id="upload_help" className="mt-1 text-center text-xs text-ink-500">
        {t("upload.hint")}
      </p>
      <Link to="/upload-help">
        <span className="text-sm">{t("upload.help")}</span>
      </Link>
    </div>
  );
}

export default function Upload({
  fetcher,
  formRef,
  loggedIn,
  redirectTo,
}: {
  fetcher: FetcherWithComponents<never>;
  formRef: React.RefObject<HTMLFormElement | null>;
  loggedIn: boolean;
  redirectTo: string;
}) {
  const { t, rich } = useTranslation();
  const [showModal, setShowModal] = React.useState(false);
  const [file, setFile] = React.useState<File | undefined>();
  const submit = useSubmit();

  function handleChangeUpload(newFile?: File) {
    setFile(newFile);
    if (loggedIn) {
      submit(formRef.current);
      return;
    }
    setShowModal(true);
  }

  return (
    <fetcher.Form
      method="POST"
      action={`/game?redirectTo=${redirectTo}`}
      encType="multipart/form-data"
      ref={formRef}
    >
      <Dialog
        isOpen={showModal}
        title={
          <div className="flex items-center gap-4">
            <ExclamationTriangle
              title={t("home.warning")}
              className="h-8 w-8"
            />
            <p>{t("upload.confirmPublic")}</p>
          </div>
        }
        onClose={() => setShowModal(false)}
        description={t("upload.confirmPublicDescription", {
          name: file?.name ?? t("upload.unknownFile"),
        })}
      >
        <div className="mb-4 flex flex-col gap-2 text-sm text-slate-300">
          <WarningMessage>{t("upload.guestWarning")}</WarningMessage>
          <p>
            {rich("upload.guidelines", {
              link: (chunks) => <Link to="/community">{chunks}</Link>,
            })}
          </p>
        </div>
        <Dialog.Footer>
          <Button
            onClick={() => {
              submit(formRef.current);
              setShowModal(false);
            }}
          >
            {t("upload.uploadPublicly")}
          </Button>
          <Button
            variant="primary"
            autoFocus
            onClick={() => {
              formRef.current?.reset();
              setFile(undefined);
              setShowModal(false);
            }}
          >
            {t("upload.cancel")}
          </Button>
        </Dialog.Footer>
      </Dialog>
      <UploadBox
        loading={fetcher.state === "submitting"}
        loadingText={
          isSiqFile(file) ? t("upload.importingSiq") : t("upload.uploading")
        }
        onChange={handleChangeUpload}
      />
    </fetcher.Form>
  );
}
