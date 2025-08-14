/**
 * Runtime test for individual field validation - bypasses type checking
 */

import { describe, it, expect } from '@jest/globals';
import { createPluginRegistry } from '../../src/core/registry/plugin-registry';
import { requiredPlugin } from '../../src/core/plugin/required';
import { stringMinPlugin } from '../../src/core/plugin/stringMin';
import { numberMinPlugin } from '../../src/core/plugin/numberMin';

describe('Individual Field Validation - Runtime', () => {
  
  it('should validate string with required and min', () => {
    const registry = createPluginRegistry()
      .use(requiredPlugin)
      .use(stringMinPlugin);
    
    const nameRule = registry.createFieldRule<string>(
      (b: any) => b.string.required({}).min(3),
      { name: 'name', description: 'Name validation' }
    );
    
    // Test valid values
    expect(nameRule.validate('John').isValid()).toBe(true);
    expect(nameRule.validate('Alice').isValid()).toBe(true);
    
    // Test invalid values
    expect(nameRule.validate('Jo').isValid()).toBe(false);
    expect(nameRule.validate('').isValid()).toBe(false);
    expect(nameRule.validate(null).isValid()).toBe(false);
  });
  
  it('should validate number with required and min', () => {
    const registry = createPluginRegistry()
      .use(requiredPlugin)
      .use(numberMinPlugin);
    
    const ageRule = registry.createFieldRule<number>(
      (b: any) => b.number.required({}).min(18),
      { name: 'age', description: 'Age validation' }
    );
    
    // Test valid values
    expect(ageRule.validate(18).isValid()).toBe(true);
    expect(ageRule.validate(25).isValid()).toBe(true);
    expect(ageRule.validate(100).isValid()).toBe(true);
    
    // Test invalid values
    expect(ageRule.validate(17).isValid()).toBe(false);
    expect(ageRule.validate(0).isValid()).toBe(false);
    expect(ageRule.validate(null).isValid()).toBe(false);
  });
  
  it('should create multiple independent field rules', () => {
    const registry = createPluginRegistry()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin);
    
    const nameRule = registry.createFieldRule<string>(
      (b: any) => b.string.required({}).min(3),
      { name: 'name' }
    );
    
    const ageRule = registry.createFieldRule<number>(
      (b: any) => b.number.required({}).min(18),
      { name: 'age' }
    );
    
    // Validate independently
    expect(nameRule.validate('John').isValid()).toBe(true);
    expect(ageRule.validate(25).isValid()).toBe(true);
    
    // Rules are independent
    expect(nameRule.validate('Jo').isValid()).toBe(false);
    expect(ageRule.validate(17).isValid()).toBe(false);
  });
});