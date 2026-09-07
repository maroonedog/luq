// ===========================================================================
// L7  src/plugins/string-uri-template/uri-template.ts
// RFC 6570 templates, scanned rather than matched. A single regex cannot say
// "no nested braces" or "the modifier must end the varspec", which is why 1.x
// hand-wrote this and why it stays hand-written.
//
// Operator set, variable alphabet and modifier rules are 1.x's verbatim:
// one optional leading operator, at least one varspec, names over
// [A-Za-z0-9_%.] with "." never first, ":" followed by 1-4 digits, and "*"
// only at the end of a varspec.
// ===========================================================================
const OPERATORS = "+#/;?&=,!@|";
const VARIABLE_NAME = /^[a-zA-Z0-9_%.]+$/;
const PREFIX_LENGTH = /^[0-9]{1,4}$/;

function isVariableName(name: string): boolean {
  if (name.length === 0 || name.startsWith(".")) return false;
  return VARIABLE_NAME.test(name);
}

function isVariableSpec(spec: string): boolean {
  if (spec.endsWith("*")) return isVariableName(spec.slice(0, -1));
  const colon = spec.indexOf(":");
  if (colon < 0) return isVariableName(spec);
  if (!PREFIX_LENGTH.test(spec.slice(colon + 1))) return false;
  return isVariableName(spec.slice(0, colon));
}

function isExpressionBody(body: string): boolean {
  const first = body[0];
  const specs =
    first !== undefined && OPERATORS.includes(first) ? body.slice(1) : body;
  if (specs.length === 0) return false;
  return specs.split(",").every(isVariableSpec);
}

export function isUriTemplate(value: string): boolean {
  let index = 0;
  while (index < value.length) {
    const character = value[index];
    if (character === "}") return false;
    if (character !== "{") {
      index += 1;
      continue;
    }
    const close = value.indexOf("}", index + 1);
    if (close < 0) return false;
    const body = value.slice(index + 1, close);
    if (body.includes("{") || !isExpressionBody(body)) return false;
    index = close + 1;
  }
  return true;
}
