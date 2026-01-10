# TSS scenario: instructions for AI

This repository uses a simple `.tss` scenario language to replay actions in a terminal. Below are brief rules and conventions derived from all existing `.tss` files and their parser.

## General format
- A file is a sequence of directives (lines ending with a colon) and their data.
- Directives are case-sensitive and must be lowercase.
- Blank lines are allowed and often used to separate blocks.

## Directives

### `audio:`
- The line after the directive contains the path to an audio file (usually `.mp3`) relative to the `scenarios/` directory.
- Example:
  ```
  audio:
  2-4-3/2-4-3.1.mp3
  ```

### `prompt:`
- The line after the directive sets the terminal prompt text.
- Used when you need to show a different prompt format.
- Use an empty line or the literal `false` to hide the prompt.
- Example:
  ```
  prompt:
  ~(as pavel):
  ```

### `input:`
- The line after the directive is user input typed “manually”.
- Supports inline delays with the `%{delay N}` marker (N in milliseconds).
- Example:
  ```
  input:
  %{delay 500}ls -l
  ```

### `paste:`
- The line after the directive is pasted text (appears faster, like a paste).
- Also supports `%{delay N}`.
- Example:
  ```
  paste:
  %{delay 500}sudo apt-get update
  ```

### `output:`
- Terminal output block. Read line-by-line until the next directive or end of file.
- Supports:
  - `%{delay N}` — pause between parts of a line.
  - Color markers: `%{begin:BGm;FGm}` … `%{end:BGm;FGm}` (ANSI colors).
- Example:
  ```
  output:
  Hello world
   %{begin:107m;30m}highlight%{end:107m;30m}
  ```

### `delay:`
- The line after the directive is a number of milliseconds, a pause between actions.
- Example:
  ```
  delay:
  1000
  ```

### `clear:`
- Clears the terminal. No data required.
- Example:
  ```
  clear:
  ```

### `scroll_lines:`
- The line after the directive is an integer: number of lines to scroll (positive down, negative up).
- Example:
  ```
  scroll_lines:
  -37
  ```

## Delay details
- `%{delay N}` can be inserted into `input:`, `paste:`, and `output:` lines to pause within a line.
- In `output:`, the text is split into parts and displayed with pauses.

## Practical recommendations
- Keep actions in a logical order: `audio:` ➜ `prompt:` ➜ `input:`/`paste:` ➜ `output:` ➜ `delay:` ➜ `clear:`.
- Always specify milliseconds as an integer.
- For readability, use blank lines between directives.
