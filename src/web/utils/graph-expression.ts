/**
 * The expression language behind the result graph's rule editor (BACK-794).
 *
 * A reader colours nodes by writing a condition over the node's own properties, and the condition
 * has to be a *boolean*: `priority >= 3 && status != "done"`. The one design rule that shapes the
 * whole grammar is that only a comparison is allowed to produce a boolean - a bare property is a
 * value, never a truthy test. So `priority && status` is an error the editor can point at, instead
 * of a condition that quietly means something the reader did not intend. It is the same reason SQL
 * separates `WHERE` from `SELECT`, and it is what keeps a mistyped rule from silently repainting
 * the picture.
 *
 * Grammar, loosest binding first:
 *
 *   or    := and ( "||" and )*
 *   and   := unary ( "&&" unary )*
 *   unary := "!" unary | operand [ compare operand ]
 *   operand := "(" or ")" | literal | property
 *
 * A parenthesised group carries whatever its contents are, so `(a == 1 || b == 2) && c == 3` works
 * while `(a) == 1` does not - a group is a condition, and comparing one is not a thing a reader
 * asks for.
 *
 * The operators: `== != > >= < <=` over numbers, strings and booleans, plus `contains` and
 * `startsWith` over text (case-insensitively, since they are a search rather than a test of
 * identity). A property the node does not carry reads as null, which simply fails to match - a rule
 * written for one result does not blow up on the next.
 */

/** A value an expression can read from a node or be written with. */
export type ExprValue = string | number | boolean | null;

/** The properties of one node, as the extraction hands them to the panel. */
export type PropertyBag = Record<string, ExprValue>;

/** A comparison operator, written between two operands. */
export type CompareOp = "==" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "startsWith";

/** The comparison operators, in the order the editor's buttons list them. */
export const COMPARE_OPERATORS: CompareOp[] = ["==", "!=", ">", ">=", "<", "<=", "contains", "startsWith"];

/** The operators the editor offers as buttons, comparisons first. */
export const LOGIC_OPERATORS = ["&&", "||", "!", "(", ")"] as const;

/** A parse or evaluation failure. `position` points at the offending character in the source. */
export class ExpressionError extends Error {
	readonly position: number;
	constructor(message: string, position: number) {
		super(message);
		this.name = "ExpressionError";
		this.position = position;
	}
}

type ExprNode =
	| { kind: "literal"; value: ExprValue }
	| { kind: "property"; name: string }
	| { kind: "compare"; op: CompareOp; left: ExprNode; right: ExprNode }
	| { kind: "not"; arg: ExprNode }
	| { kind: "and"; left: ExprNode; right: ExprNode }
	| { kind: "or"; left: ExprNode; right: ExprNode };

/** True for the nodes a condition may be built from - the ones that stand for a yes or a no. */
function isCondition(node: ExprNode): boolean {
	return node.kind === "compare" || node.kind === "not" || node.kind === "and" || node.kind === "or";
}

type TokenKind = "ident" | "string" | "number" | "symbol";

interface Token {
	kind: TokenKind;
	value: string;
	start: number;
}

const WORD = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Is this identifier one of the comparison operators that are words (`contains`)? */
function wordOperator(value: string): CompareOp | null {
	return value === "contains" || value === "startsWith" ? value : null;
}

/**
 * Split a condition into tokens. Quoted text is one string token whatever it contains, so a value
 * with spaces or operators in it (`status == "in progress"`) needs no escaping discipline beyond
 * quoting.
 */
function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let index = 0;
	while (index < input.length) {
		const char = input.charAt(index);
		if (char === " " || char === "\t" || char === "\n" || char === "\r") {
			index += 1;
			continue;
		}
		const start = index;
		if (char === '"' || char === "'") {
			index += 1;
			let text = "";
			let closed = false;
			while (index < input.length) {
				const inner = input.charAt(index);
				if (inner === "\\" && index + 1 < input.length) {
					text += input.charAt(index + 1);
					index += 2;
					continue;
				}
				if (inner === char) {
					closed = true;
					index += 1;
					break;
				}
				text += inner;
				index += 1;
			}
			if (!closed) throw new ExpressionError("unterminated text", start);
			tokens.push({ kind: "string", value: text, start });
			continue;
		}
		if (/[0-9]/.test(char) || (char === "-" && /[0-9]/.test(input.charAt(index + 1)))) {
			index += 1;
			let text = char;
			while (index < input.length && /[0-9.]/.test(input.charAt(index))) {
				text += input.charAt(index);
				index += 1;
			}
			if (Number.isNaN(Number(text))) throw new ExpressionError(`not a number: ${text}`, start);
			tokens.push({ kind: "number", value: text, start });
			continue;
		}
		if (/[A-Za-z_]/.test(char)) {
			index += 1;
			while (index < input.length && /[A-Za-z0-9_]/.test(input.charAt(index))) index += 1;
			tokens.push({ kind: "ident", value: input.slice(start, index), start });
			continue;
		}
		const pair = input.slice(index, index + 2);
		if (pair === "==" || pair === "!=" || pair === ">=" || pair === "<=" || pair === "&&" || pair === "||") {
			tokens.push({ kind: "symbol", value: pair, start });
			index += 2;
			continue;
		}
		if (char === ">" || char === "<" || char === "!" || char === "(" || char === ")") {
			tokens.push({ kind: "symbol", value: char, start });
			index += 1;
			continue;
		}
		throw new ExpressionError(`unexpected character "${char}"`, start);
	}
	return tokens;
}

/** The cursor over a token list, with the errors a reader's typo produces. */
class Cursor {
	private index = 0;
	constructor(private readonly tokens: Token[]) {}

	/** The next token, or null at the end. */
	peek(): Token | null {
		return this.tokens[this.index] ?? null;
	}

	/** The position the next token starts at, or the end of the source. */
	position(): number {
		const token = this.peek();
		return token ? token.start : (this.tokens[this.tokens.length - 1]?.start ?? 0);
	}

	/** Take the next token, or throw `what` is missing. */
	take(what: string): Token {
		const token = this.peek();
		if (!token) throw new ExpressionError(`expected ${what}`, this.position());
		this.index += 1;
		return token;
	}

	/** Consume a symbol token when it is next, answering whether it was there. */
	acceptSymbol(value: string): boolean {
		const token = this.peek();
		if (token?.kind !== "symbol" || token.value !== value) return false;
		this.index += 1;
		return true;
	}

	/** Consume an identifier token whose text is `value`. */
	acceptWord(value: string): boolean {
		const token = this.peek();
		if (token?.kind !== "ident" || token.value !== value) return false;
		this.index += 1;
		return true;
	}

	done(): boolean {
		return this.index >= this.tokens.length;
	}
}

/** Parse `a || b || c`. Both sides must already be conditions - see `requireCondition`. */
function parseOr(cursor: Cursor): ExprNode {
	let left = parseAnd(cursor);
	while (cursor.acceptSymbol("||")) {
		const right = parseAnd(cursor);
		requireCondition(left, cursor);
		requireCondition(right, cursor);
		left = { kind: "or", left, right };
	}
	return left;
}

/** Parse `a && b && c`. */
function parseAnd(cursor: Cursor): ExprNode {
	let left = parseUnary(cursor);
	while (cursor.acceptSymbol("&&")) {
		const right = parseUnary(cursor);
		requireCondition(left, cursor);
		requireCondition(right, cursor);
		left = { kind: "and", left, right };
	}
	return left;
}

/** Parse `!a` - a negation of something that is already a condition. */
function parseUnary(cursor: Cursor): ExprNode {
	if (cursor.acceptSymbol("!")) {
		const arg = parseUnary(cursor);
		requireCondition(arg, cursor);
		return { kind: "not", arg };
	}
	return parseComparison(cursor);
}

/** Parse `a == b`, or just `a` - which the caller decides was a mistake. */
function parseComparison(cursor: Cursor): ExprNode {
	const left = parseOperand(cursor);
	const operator = readCompareOperator(cursor);
	if (!operator) return left;
	const right = parseOperand(cursor);
	if (isCondition(left) || isCondition(right)) {
		throw new ExpressionError("a comparison compares values, not conditions", cursor.position());
	}
	return { kind: "compare", op: operator, left, right };
}

/** The comparison operator under the cursor, whether written as a symbol or a word. */
function readCompareOperator(cursor: Cursor): CompareOp | null {
	const token = cursor.peek();
	if (!token) return null;
	if (token.kind === "symbol") {
		if (token.value === "==" || token.value === "!=" || token.value === ">=" || token.value === "<=") {
			cursor.take("an operator");
			return token.value;
		}
		if (token.value === ">" || token.value === "<") {
			cursor.take("an operator");
			return token.value;
		}
		return null;
	}
	if (token.kind === "ident") {
		const word = wordOperator(token.value);
		if (word) {
			cursor.take("an operator");
			return word;
		}
	}
	return null;
}

/** Parse one operand: a group, a literal, or a property name. */
function parseOperand(cursor: Cursor): ExprNode {
	const token = cursor.take("a value");
	if (token.kind === "symbol") {
		if (token.value !== "(") throw new ExpressionError(`unexpected "${token.value}"`, token.start);
		const inner = parseOr(cursor);
		const close = cursor.peek();
		if (!close || close.kind !== "symbol" || close.value !== ")") {
			throw new ExpressionError("missing closing bracket", cursor.position());
		}
		cursor.take("a closing bracket");
		return inner;
	}
	if (token.kind === "string") return { kind: "literal", value: token.value };
	if (token.kind === "number") return { kind: "literal", value: Number(token.value) };
	if (token.value === "true") return { kind: "literal", value: true };
	if (token.value === "false") return { kind: "literal", value: false };
	if (token.value === "null") return { kind: "literal", value: null };
	if (!WORD.test(token.value)) throw new ExpressionError(`not a value: "${token.value}"`, token.start);
	return { kind: "property", name: token.value };
}

/** Reject an operand standing where a condition belongs - the grammar's one real rule. */
function requireCondition(node: ExprNode, cursor: Cursor): boolean {
	if (isCondition(node)) return true;
	throw new ExpressionError("expected a comparison", cursor.position());
}

/** Property values are whatever the database holds; `null` is the absence of one. */
function text(value: ExprValue): string {
	return value === null ? "" : String(value);
}

/** `contains` and `startsWith` are a search: case does not decide the answer. */
function fold(value: ExprValue): string {
	return text(value).toLowerCase();
}

/**
 * Equality across a result whose numbers sometimes arrive as text: same type compares directly,
 * different types compare as text, and null equals only null. A reader writing `priority == 3`
 * should not have to know which shape the value came back in.
 */
function looseEqual(left: ExprValue, right: ExprValue): boolean {
	if (left === null || right === null) return left === right;
	if (typeof left === typeof right) return left === right;
	return text(left) === text(right);
}

function compare(op: CompareOp, left: ExprValue, right: ExprValue): boolean {
	if (op === "contains") return fold(left).includes(fold(right));
	if (op === "startsWith") return fold(left).startsWith(fold(right));
	if (op === "==") return looseEqual(left, right);
	if (op === "!=") return !looseEqual(left, right);
	// Ordering below: numbers by magnitude, booleans as 0/1, anything else as text. A value the
	// node does not carry sorts as empty text, so it never outranks a real one.
	if (typeof left === "number" && typeof right === "number") {
		if (op === ">") return left > right;
		if (op === ">=") return left >= right;
		if (op === "<") return left < right;
		return left <= right;
	}
	if (typeof left === "boolean" || typeof right === "boolean") {
		const a = Number(left ?? 0);
		const b = Number(right ?? 0);
		if (op === ">") return a > b;
		if (op === ">=") return a >= b;
		if (op === "<") return a < b;
		return a <= b;
	}
	const a = text(left);
	const b = text(right);
	if (op === ">") return a > b;
	if (op === ">=") return a >= b;
	if (op === "<") return a < b;
	return a <= b;
}

/** Read one node: conditions answer a boolean, operands a value. */
function read(node: ExprNode, properties: PropertyBag): ExprValue {
	switch (node.kind) {
		case "literal":
			return node.value;
		case "property": {
			const value = properties[node.name];
			return value === undefined ? null : value;
		}
		case "compare":
			return compare(node.op, read(node.left, properties), read(node.right, properties));
		case "not":
			return !read(node.arg, properties);
		case "and":
			return read(node.left, properties) === true && read(node.right, properties) === true;
		case "or":
			return read(node.left, properties) === true || read(node.right, properties) === true;
	}
}

/** A condition, compiled once and asked of every node. */
export interface CompiledExpression {
	readonly source: string;
	/** Does this node match? An empty condition matches nothing, so its nodes fall through. */
	test(properties: PropertyBag): boolean;
}

/**
 * Compile a condition. Throws `ExpressionError` on a typo, which is the point: the editor shows
 * the message and the position instead of treating the rule as harmlessly false.
 */
export function compileExpression(source: string): CompiledExpression {
	const cursor = new Cursor(tokenize(source));
	if (cursor.done()) return { source, test: () => false }; // an empty rule matches nothing
	const root = parseOr(cursor);
	if (!isCondition(root)) throw new ExpressionError("expected a comparison", cursor.position());
	const trailing = cursor.peek();
	if (trailing) throw new ExpressionError(`unexpected "${trailing.value}"`, trailing.start);
	return { source, test: (properties) => read(root, properties) === true };
}

/**
 * The error a condition carries, or null when it is well formed. The panel calls this per
 * keystroke; it never throws, so a half-typed rule is a message rather than a crash.
 */
export function expressionError(source: string): string | null {
	try {
		compileExpression(source);
		return null;
	} catch (error) {
		return error instanceof ExpressionError ? error.message : "invalid condition";
	}
}

/** The property names a condition reads, in the order they are written, without duplicates. */
export function expressionFields(source: string): string[] {
	const fields: string[] = [];
	try {
		for (const token of tokenize(source)) {
			if (token.kind !== "ident" || !WORD.test(token.value)) continue;
			if (wordOperator(token.value)) continue;
			if (token.value === "true" || token.value === "false" || token.value === "null") continue;
			if (!fields.includes(token.value)) fields.push(token.value);
		}
	} catch {
		return fields; // a half-typed rule yields whatever names were readable
	}
	return fields;
}
