# Sigil Generation Utilities

Core algorithms for transforming user intentions into visual symbols (sigils) using the Austin Osman Spare method.

## Letter Distillation

The `distillation.ts` module implements the letter distillation algorithm that reduces written intentions to their essential letters.

### Algorithm (Austin Osman Spare Method)

1. **Remove Spaces** - Strip all whitespace from the intention text
2. **Remove Vowels** - Remove all vowels (A, E, I, O, U) case-insensitively
3. **Remove Duplicates** - Remove duplicate letters, keeping only the first occurrence
4. **Convert to Uppercase** - Return final letters in uppercase

### Examples

```typescript
import { distillIntention } from './distillation';

// Example 1: "Close the deal"
const result1 = distillIntention('Close the deal');
// Process: "Close the deal" → "Closethedeal" → "Clsthdl" → "Clsthd"
// Result: ["C", "L", "S", "T", "H", "D"]

// Example 2: "Find inner peace"
const result2 = distillIntention('Find inner peace');
// Process: "Find inner peace" → "Findinnerpeace" → "Fndnnrpc" → "Fndrpc"
// Result: ["F", "N", "D", "R", "P", "C"]

// Example 3: "Launch my startup"
const result3 = distillIntention('Launch my startup');
// Result: ["L", "N", "C", "H", "M", "Y", "S", "T", "R", "P"]
```

### API

#### `distillIntention(intentionText: string): DistillationResult`

Main distillation function.

**Parameters:**
- `intentionText` - The user's intention text to distill

**Returns:** `DistillationResult`
```typescript
interface DistillationResult {
  original: string;           // Original input text
  finalLetters: string[];     // Final distilled letters (uppercase)
  removedVowels: string[];    // Vowels that were removed
  removedDuplicates: string[]; // Duplicate letters that were removed
}
```

#### `validateIntention(intentionText: string): ValidationResult`

Validates that an intention can be properly distilled.

**Validation Rules:**
- Must not be empty
- Must contain at least one letter
- Must be at least 3 characters long
- Must be 100 characters or less
- Must produce at least 2 unique letters after distillation

**Returns:**
```typescript
{
  isValid: boolean;
  error?: string;
}
```

#### `getDistillationSummary(result: DistillationResult): string`

Creates a human-readable summary of the distillation process.

**Example:**
```typescript
const result = distillIntention('Close the deal');
const summary = getDistillationSummary(result);
// "CLOSETHEDEAL → CLSTHD → C L S T H D"
```

### Usage in Anchor Creation Flow

The distillation algorithm is used in Step 2 of the 11-step anchor creation flow:

1. User enters intention text
2. **Distillation Animation** - Show letter removal process visually
3. Traditional sigil generation uses distilled letters
4. ... rest of creation flow

### Testing

Comprehensive unit tests in `distillation.test.ts` cover:

- ✅ Basic distillation examples
- ✅ Vowel removal (all vowels a,e,i,o,u)
- ✅ Duplicate letter removal
- ✅ Case handling (mixed case, uppercase, lowercase)
- ✅ Space handling (single, multiple, leading, trailing)
- ✅ Special characters (numbers, punctuation, symbols)
- ✅ Edge cases (empty, only vowels, only special chars)
- ✅ Validation rules

Run tests:
```bash
npm test distillation.test.ts
```

### Implementation Notes

**Performance:**
- Time complexity: O(n) where n is input length
- Space complexity: O(n) for result arrays
- Fast enough for real-time UI updates

**Character Handling:**
- Only alphabetic characters (a-z, A-Z) are processed
- Numbers, punctuation, and special characters are ignored
- All whitespace (spaces, tabs, newlines) is removed
- Case-insensitive duplicate detection

**Why Austin Osman Spare?**

This method is based on chaos magick traditions for creating sigils from written statements of intent. By reducing the text to essential letters, we create a unique "fingerprint" that can be transformed into a visual symbol.

### Future Enhancements

Planned for Phase 2+:
- [ ] Animation of distillation process
- [ ] Visual feedback showing removed letters
- [ ] Alternative distillation methods
- [ ] Internationalization (non-English alphabets)

---

**See Also:**
- `traditional-generator.ts` - SVG sigil generation from distilled letters
- `letter-vectors.ts` - Letter shape data for merging
- Handoff Document Section 5.1 - Letter Distillation Algorithm
