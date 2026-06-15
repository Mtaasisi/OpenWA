import { parseLlmTrainingSuggestions } from './ai-training-suggestion.service';

describe('parseLlmTrainingSuggestions', () => {
  it('parses fenced JSON options', () => {
    const raw = `\`\`\`json
{"options":[{"optionText":"Ask branch","responseText":"Upo branch gani?","actionType":"create_tool_rule","targetFile":"BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md","recommended":true}]}
\`\`\``;
    const options = parseLlmTrainingSuggestions(raw);
    expect(options).toHaveLength(1);
    expect(options[0].optionText).toBe('Ask branch');
    expect(options[0].actionType).toBe('create_tool_rule');
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseLlmTrainingSuggestions('not json')).toEqual([]);
  });
});
