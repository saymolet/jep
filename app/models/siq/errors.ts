/** SiqImportError is a problem with an uploaded SIGame pack that the user
 * can understand and fix; its message is shown to them. */
export class SiqImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiqImportError";
  }
}
