import { z } from "zod";
import { zodToJsonSchema } from "../utils";
import { validatedNodeEdgeDataSchema } from "../utils/validator";
import {
  EdgeSchema,
  HeightSchema,
  NodeSchema,
  TextureSchema,
  ThemeSchema,
  WidthSchema,
} from "./base";

// Network graph input schema. Bounds are intentionally generous for
// legitimate analytics graphs but finite: an attacker cannot make the
// renderer allocate / iterate over millions of elements.
const MAX_NODES = 500;
const MAX_EDGES = 2_000;

const schema = {
  data: z
    .object({
      nodes: z
        .array(NodeSchema)
        .nonempty({ message: "At least one node is required." })
        .max(MAX_NODES, {
          message: `Too many nodes (max ${MAX_NODES}).`,
        }),
      edges: z.array(EdgeSchema).max(MAX_EDGES, {
        message: `Too many edges (max ${MAX_EDGES}).`,
      }),
    })
    .describe(
      "Data for network graph chart, such as, { nodes: [{ name: 'node1' }, { name: 'node2' }], edges: [{ source: 'node1', target: 'node2', name: 'edge1' }] }",
    )
    .refine(validatedNodeEdgeDataSchema, {
      message: "Invalid parameters",
      path: ["data", "edges"],
    }),
  style: z
    .object({
      texture: TextureSchema,
    })
    .optional()
    .describe(
      "Style configuration for the chart with a JSON object, optional.",
    ),
  theme: ThemeSchema,
  width: WidthSchema,
  height: HeightSchema,
};

// Network graph tool descriptor
const tool = {
  name: "generate_network_graph",
  description:
    "Generate a network graph chart to show relationships (edges) between entities (nodes), such as, relationships between people in social networks.",
  inputSchema: zodToJsonSchema(schema),
  annotations: {
    title: "Generate Network Graph",
    readOnlyHint: true,
  },
};

export const networkGraph = {
  schema,
  tool,
};
