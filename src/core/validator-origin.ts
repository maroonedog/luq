const origins = new WeakMap<object, object>();

/** Preserve a validator's identity across built-in decorators. */
export function inheritValidatorOrigin<T extends object>(
  source: object,
  target: T
): T {
  origins.set(target, readValidatorOrigin(source));
  return target;
}

export function readValidatorOrigin(validator: object): object {
  return origins.get(validator) ?? validator;
}
