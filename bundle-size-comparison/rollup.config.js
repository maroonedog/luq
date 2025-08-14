import terser from "@rollup/plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default [
  // FormTailor Builder Pattern
  {
    input: "test-formtailor.js",
    output: {
      file: "dist/formtailor-builder.min.js",
      format: "es",
    },
    plugins: [resolve(), commonjs(), terser()],
  },
  // FormTailor Pure Functions
  {
    input: "test-pure-functions.js",
    output: {
      file: "dist/formtailor-pure.min.js",
      format: "es",
    },
    plugins: [resolve(), commonjs(), terser()],
  },
  // Zod
  {
    input: "test-zod.js",
    output: {
      file: "dist/zod.min.js",
      format: "es",
    },
    plugins: [resolve(), commonjs(), terser()],
  },
  // Yup
  {
    input: "test-yup.js",
    output: {
      file: "dist/yup.min.js",
      format: "es",
    },
    plugins: [resolve(), commonjs(), terser()],
  },
  // Valibot
  {
    input: "test-valibot.js",
    output: {
      file: "dist/valibot.min.js",
      format: "es",
    },
    plugins: [resolve(), commonjs(), terser()],
  },
];
