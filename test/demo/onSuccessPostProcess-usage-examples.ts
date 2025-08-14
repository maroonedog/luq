/**
 * 🎯 onSuccessPostProcess method usage examples demo
 * 
 * Examples of post-processing functionality executed in validate/parse method chains
 */

import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { transformPlugin } from "../../src/core/plugin/transform";

// ==========================================
// 🎉 Basic usage example
// ==========================================

type UserRegistration = {
  username: string;
  email: string;
  password: string;
};

const userValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .for<UserRegistration>()
  .v("username", (b) => b.string.required().min(3))
  .v("email", (b) => b.string.required())
  .v("password", (b) => b.string.required().min(8))
  .build();

console.log("=== Basic usage example ===");

// ✅ Log output on success
const registrationData = {
  username: "newuser",
  email: "user@example.com",
  password: "securepassword123"
};

userValidator
  .validate(registrationData)
  .onSuccessPostProcess((data) => {
    console.log(`✅ User registration validated: ${data.username}`);
    console.log(`📧 Email: ${data.email}`);
  })
  .tapError((errors) => {
    console.log(`❌ Validation failed:`, errors.map(e => e.message));
  });

// ❌ No post-processing on failure
const invalidData = {
  username: "u",  // too short
  email: "user@example.com",
  password: "123" // too short
};

userValidator
  .validate(invalidData)
  .onSuccessPostProcess((data) => {
    console.log(`This line will not be executed: ${data.username}`);
  })
  .tapError((errors) => {
    console.log(`❌ Registration failed: ${errors.length} errors`);
  });

// ==========================================
// 🔄 Usage example with parse method
// ==========================================

console.log("\n=== Usage example with parse method ===");

type ScoreData = {
  studentId: string;
  rawScore: number;
};

const scoreValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(transformPlugin)
  .for<ScoreData>()
  .v("studentId", (b) => b.string.required().min(5))
  .v("rawScore", (b) => 
    b.number.required().transform((score: number) => Math.round(score * 100))
  )
  .build();

const scoreData = { studentId: "STD001", rawScore: 0.856 };

scoreValidator
  .parse(scoreData)
  .onSuccessPostProcess((transformedData) => {
    console.log(`📊 Score processed for ${transformedData.studentId}`);
    console.log(`🔢 Final score: ${transformedData.rawScore}%`);
  });

// ==========================================
// 📈 Practical application examples
// ==========================================

console.log("\n=== Practical application examples ===");

// 1. Cache update
const cache = new Map<string, any>();

type CacheableData = { id: string; content: string };

const cacheValidator = Builder()
  .use(requiredPlugin)
  .for<CacheableData>()
  .v("id", (b) => b.string.required())
  .v("content", (b) => b.string.required())
  .build();

cacheValidator
  .validate({ id: "item-123", content: "cached content" })
  .onSuccessPostProcess((data) => {
    cache.set(data.id, data.content);
    console.log(`💾 Cached item: ${data.id}`);
  });

console.log(`Cache size: ${cache.size}`);

// 2. External API call (mock)
type ApiData = { userId: string; action: string };

const apiValidator = Builder()
  .use(requiredPlugin)
  .for<ApiData>()
  .v("userId", (b) => b.string.required())
  .v("action", (b) => b.string.required())
  .build();

apiValidator
  .validate({ userId: "user_456", action: "login" })
  .onSuccessPostProcess(async (data) => {
    // In real applications, external API would be called here
    console.log(`🌐 Would call API for user: ${data.userId}, action: ${data.action}`);
  });

// 3. Metrics collection
const metrics = {
  validationSuccess: 0,
  validationFailure: 0,
  processedUsers: new Set<string>()
};

type MetricData = { userId: string; operation: string };

const metricValidator = Builder()
  .use(requiredPlugin)
  .for<MetricData>()
  .v("userId", (b) => b.string.required())
  .v("operation", (b) => b.string.required())
  .build();

// Success case
metricValidator
  .validate({ userId: "metric_user_1", operation: "create" })
  .onSuccessPostProcess((data) => {
    metrics.validationSuccess++;
    metrics.processedUsers.add(data.userId);
    console.log(`📊 Metrics updated - Success: ${metrics.validationSuccess}`);
  })
  .tapError(() => {
    metrics.validationFailure++;
  });

// Failure case
metricValidator
  .validate({ userId: "", operation: "delete" }) // empty userId
  .onSuccessPostProcess((data) => {
    metrics.validationSuccess++;
    metrics.processedUsers.add(data.userId);
  })
  .tapError(() => {
    metrics.validationFailure++;
    console.log(`📊 Metrics updated - Failure: ${metrics.validationFailure}`);
  });

console.log(`\n📈 Final metrics:`, {
  success: metrics.validationSuccess,
  failure: metrics.validationFailure,
  uniqueUsers: metrics.processedUsers.size
});

// ==========================================
// 🔗 Method chain combinations
// ==========================================

console.log("\n=== Method chain combinations ===");

type ComplexData = { name: string; score: number };

const complexValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(transformPlugin)
  .for<ComplexData>()
  .v("name", (b) => b.string.required().min(3))
  .v("score", (b) => 
    b.number.required().transform((n: number) => Math.max(0, Math.min(100, n)))
  )
  .build();

const testData = { name: "Alice", score: 150 }; // Score exceeds the upper limit

complexValidator
  .parse(testData)
  .tap((data) => {
    console.log(`🔍 Initial processing: ${data.name}`);
  })
  .onSuccessPostProcess((data) => {
    console.log(`✅ Post-process complete: ${data.name}, normalized score: ${data.score}`);
  })
  .map((data) => ({
    ...data,
    grade: data.score >= 90 ? 'A' : data.score >= 80 ? 'B' : data.score >= 70 ? 'C' : 'D'
  }))
  .tap((enrichedData) => {
    console.log(`🎓 Final result: ${enrichedData.name} got grade ${enrichedData.grade}`);
  });

// ==========================================
// 📋 Summary
// ==========================================

console.log("\n=== onSuccessPostProcess Summary ===");
console.log("✅ Executed only when validation succeeds");
console.log("✅ Can be used with both validate() and parse()");
console.log("✅ Same functionality as tap() method but with a clearer name");
console.log("✅ Can be combined with other operations in method chains");
console.log("✅ Useful for logging, cache updates, API calls, metrics collection, etc.");
console.log("✅ Safe post-processing as it's not executed on errors");

export {};