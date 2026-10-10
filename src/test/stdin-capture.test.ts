import { describe, expect, it } from "bun:test";
import { PassThrough } from "node:stream";
import {
	captureInteractiveBody,
	INTERACTIVE_CAPTURE_HINT,
	InteractiveCaptureAbortedError,
} from "../core/interactive-input.ts";

/**
 * Unit tests for the interactive multi-line capture helper, driven with fake streams.
 * The CLI path is covered separately in cli-memo-stdin.test.ts.
 */

function fakeStream(): PassThrough {
	return new PassThrough();
}

function fakeStreamWithRawMode(isTTY: boolean): { stream: PassThrough; setRawModeCalls: boolean[] } {
	const stream = new PassThrough() as PassThrough & {
		isTTY: boolean;
		setRawMode(mode: boolean): void;
	};
	const setRawModeCalls: boolean[] = [];
	stream.isTTY = isTTY;
	stream.setRawMode = (mode: boolean) => {
		setRawModeCalls.push(mode);
	};
	return { stream, setRawModeCalls };
}

async function readAll(stream: PassThrough): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
	}
	return Buffer.concat(chunks).toString("utf8");
}

describe("captureInteractiveBody", () => {
	it("captures multiple lines verbatim without a trailing terminator", async () => {
		const stream = fakeStream();
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("line one\nline two");
		expect(await promise).toBe("line one\nline two");
	});

	it("keeps a trailing line terminator when the input ends with one", async () => {
		const stream = fakeStream();
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("a\nb\n");
		expect(await promise).toBe("a\nb\n");
	});

	it("normalizes CRLF terminators to LF", async () => {
		const stream = fakeStream();
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("a\r\nb\r\n");
		expect(await promise).toBe("a\nb\n");
	});

	it("normalizes bare carriage returns (raw TTY Enter key) to LF", async () => {
		const stream = fakeStream();
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("a\rb\r");
		expect(await promise).toBe("a\nb\n");
	});

	it("resolves with an empty string on immediate EOF", async () => {
		const stream = fakeStream();
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end();
		expect(await promise).toBe("");
	});

	it("ends on a lone Ctrl+D character and keeps the pending line", async () => {
		const stream = fakeStream();
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("hello\x04");
		expect(await promise).toBe("hello");
	});

	it("ends on Ctrl+D at an empty line with an empty body", async () => {
		const stream = fakeStream();
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("\x04");
		expect(await promise).toBe("");
	});

	it("keeps lines already terminated when Ctrl+D ends the capture", async () => {
		const stream = fakeStream();
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("first\nsecond\n\x04");
		expect(await promise).toBe("first\nsecond\n");
	});

	it("ends on a line containing only Ctrl+Z and drops that line", async () => {
		const stream = fakeStream();
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("first\n\x1a\nsecond");
		expect(await promise).toBe("first\n");
	});

	it("treats Ctrl+Z inside a line as literal content (only a Ctrl+Z-only line ends capture)", async () => {
		const stream = fakeStream();
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("a\x1ab\n");
		expect(await promise).toBe("a\x1ab\n");
	});

	it("rejects with InteractiveCaptureAbortedError on Ctrl+C", async () => {
		const stream = fakeStream();
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("partial\x03");
		await expect(promise).rejects.toBeInstanceOf(InteractiveCaptureAbortedError);
	});

	it("rejects when the AbortSignal fires mid-capture", async () => {
		const stream = fakeStream();
		const controller = new AbortController();
		const promise = captureInteractiveBody(stream, new PassThrough(), { signal: controller.signal });
		stream.write("partial\n");
		setTimeout(() => controller.abort(), 10);
		await expect(promise).rejects.toBeInstanceOf(InteractiveCaptureAbortedError);
	});

	it("rejects immediately when the AbortSignal is already aborted", async () => {
		const stream = fakeStream();
		const controller = new AbortController();
		controller.abort();
		const promise = captureInteractiveBody(stream, new PassThrough(), { signal: controller.signal });
		stream.end();
		await expect(promise).rejects.toBeInstanceOf(InteractiveCaptureAbortedError);
	});

	it("writes the hint to the hint stream, never into the captured body", async () => {
		const stream = fakeStream();
		const hint = new PassThrough();
		const hintPromise = readAll(hint);
		const promise = captureInteractiveBody(stream, hint);
		stream.end("note\n\x04");
		const body = await promise;
		hint.end();
		const hintText = await hintPromise;
		expect(hintText).toBe(INTERACTIVE_CAPTURE_HINT);
		expect(body).not.toContain(INTERACTIVE_CAPTURE_HINT);
		expect(body).toBe("note\n");
	});

	it("enables raw mode for a TTY and restores it on completion", async () => {
		const { stream, setRawModeCalls } = fakeStreamWithRawMode(true);
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("typed on a tty\x04");
		expect(await promise).toBe("typed on a tty");
		expect(setRawModeCalls).toEqual([true, false]);
	});

	it("restores raw mode when the capture aborts", async () => {
		const { stream, setRawModeCalls } = fakeStreamWithRawMode(true);
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("\x03");
		await expect(promise).rejects.toBeInstanceOf(InteractiveCaptureAbortedError);
		expect(setRawModeCalls).toEqual([true, false]);
	});

	it("does not touch raw mode for a non-TTY stream", async () => {
		const { stream, setRawModeCalls } = fakeStreamWithRawMode(false);
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("piped\n");
		expect(await promise).toBe("piped\n");
		expect(setRawModeCalls).toEqual([]);
	});

	it("echoes typed characters to the echo target on a TTY (raw mode has no terminal echo)", async () => {
		const { stream } = fakeStreamWithRawMode(true);
		const echo = new PassThrough();
		const echoPromise = readAll(echo);
		const promise = captureInteractiveBody(stream, new PassThrough(), { echoTarget: echo });
		stream.end("hi\n\x04");
		expect(await promise).toBe("hi\n");
		echo.end();
		// Typed characters, the Enter echo, and the final newline that returns the cursor.
		expect(await echoPromise).toBe("hi\n\n");
	});

	it("does not echo for a non-TTY stream even when an echo target is passed", async () => {
		const stream = new PassThrough();
		const echo = new PassThrough();
		const echoPromise = readAll(echo);
		const promise = captureInteractiveBody(stream, new PassThrough(), { echoTarget: echo });
		stream.end("piped\n");
		expect(await promise).toBe("piped\n");
		echo.end();
		expect(await echoPromise).toBe("");
	});

	it("handles backspace on the current line and echoes the cursor erase", async () => {
		const { stream } = fakeStreamWithRawMode(true);
		const echo = new PassThrough();
		const echoPromise = readAll(echo);
		const promise = captureInteractiveBody(stream, new PassThrough(), { echoTarget: echo });
		stream.end("ab\x7fc\n\x04");
		expect(await promise).toBe("ac\n");
		echo.end();
		expect(await echoPromise).toBe("ab\b \bc\n\n");
	});

	it("ignores backspace at the start of a line", async () => {
		const { stream } = fakeStreamWithRawMode(true);
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("\x7f\x08hi\n\x04");
		expect(await promise).toBe("hi\n");
	});

	it("removes a full surrogate pair on backspace", async () => {
		const { stream } = fakeStreamWithRawMode(true);
		const promise = captureInteractiveBody(stream, new PassThrough());
		stream.end("a\u{1f600}\x7f\n\x04");
		expect(await promise).toBe("a\n");
	});
});
