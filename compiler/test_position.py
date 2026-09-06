#!/usr/bin/env python3

text = """@validator
interface User {
  @required
  name: string
  @
  email: string
}"""

lines = text.split('\n')
for i, line in enumerate(lines):
    print(f"Line {i}: '{line}'")