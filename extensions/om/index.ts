import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { formatOmEntries, queryOmMemory } from './lib/om';

export default function activate(pi: ExtensionContext): void {
  pi.registerTool({
    name: 'om_recall',
    label: 'OM Recall',
    description:
      'Query observational memory by date. Returns key observations and reflections from ' +
      'previous Pi sessions. Use for: "what did I do yesterday", "what happened on Monday".',
    promptSnippet: 'Query OM memory by date',
    promptGuidelines: [
      'Use om_recall when the user asks about past work: "what did I do yesterday", "what happened on Monday", etc.',
      'Do NOT use om_recall for knowledge base queries — use kb_recall_context or kb_recall_docs instead.',
    ],
    parameters: Type.Object({
      date: Type.String({
        description: 'Date query: "yesterday", "today", "last 3 days", or YYYY-MM-DD',
      }),
      verbose: Type.Optional(
        Type.Boolean({
          description:
            'Show all observations including low/medium relevance (default: false, shows high/critical only)',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const entries = queryOmMemory(params.date);

      if (entries.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text:
                `No observational memory found for "${params.date}". ` +
                'This could mean: no sessions on that date, or sessions were not compacted.',
            },
          ],
          details: { date: params.date, count: 0 },
        };
      }

      const formatted = formatOmEntries(entries, { verbose: params.verbose });

      return {
        content: [{ type: 'text', text: formatted }],
        details: {
          date: params.date,
          count: entries.length,
          observations: entries.filter((e) => e.type === 'observation').length,
          reflections: entries.filter((e) => e.type === 'reflection').length,
        },
      };
    },
  });
}
