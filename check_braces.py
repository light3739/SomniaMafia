
import sys
import os

def count_braces(filename):
    if not os.path.exists(filename):
        print(f"File not found: {filename}")
        return
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        line_num = i + 1
        # Skip comments (basic logic)
        clean_line = line.split('//')[0]
        # Skip strings (extremely basic)
        in_string = False
        for char in clean_line:
            if char in ['"', "'"]: in_string = not in_string
            if in_string: continue
            
            if char == '{':
                stack.append(line_num)
            elif char == '}':
                if not stack:
                    # print(f"Unmatched closing brace at line {line_num}")
                    pass
                else:
                    opened_at = stack.pop()
                    if opened_at == 118:
                        print(f"GameProvider (line 118) closed at line {line_num}")
                        # print the next few lines
                        for j in range(i, min(i+10, len(lines))):
                            print(f"{j+1}: {lines[j]}", end='')
                        return

if len(sys.argv) > 1:
    count_braces(sys.argv[1])
else:
    print("Usage: python check_braces.py <filename>")
