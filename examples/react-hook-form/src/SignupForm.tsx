import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { signupSchema, type Signup } from "./signup-schema";

/**
 * The whole integration is the one `resolver` line. react-hook-form takes any
 * Standard Schema, and a Luq validator is one.
 */
export function SignupForm() {
  const [submitted, setSubmitted] = useState<Signup | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Signup>({
    resolver: standardSchemaResolver(signupSchema),
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((data) => {
        // `data` arrives normalized: the name is trimmed, the email is
        // lowercased, and age is a number even though the input gave a
        // string. The resolver reads the value Luq wrote back.
        setSubmitted(data);
      })}
    >
      <h1>Sign up</h1>

      <label htmlFor="name">Name</label>
      <input id="name" type="text" {...register("name")} />
      {errors.name !== undefined && <p role="alert">{errors.name.message}</p>}

      <label htmlFor="email">Email</label>
      <input id="email" type="text" {...register("email")} />
      {errors.email !== undefined && <p role="alert">{errors.email.message}</p>}

      <label htmlFor="age">Age</label>
      <input id="age" type="number" {...register("age")} />
      {errors.age !== undefined && <p role="alert">{errors.age.message}</p>}

      <button type="submit" disabled={isSubmitting}>
        Create account
      </button>

      {submitted !== null && (
        <pre aria-label="submitted payload">
          {JSON.stringify(submitted, null, 2)}
        </pre>
      )}
    </form>
  );
}
