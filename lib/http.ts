export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function jsonError(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { error: error.message, ...error.payload },
      { status: error.status },
    );
  }

  console.error(error);
  return Response.json({ error: "伺服器錯誤" }, { status: 500 });
}
