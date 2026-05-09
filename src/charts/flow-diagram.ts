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

// Flow diagram input schema. Bounds protect the renderer from
// request-driven memory blow-up; flow diagrams are typically small
// (≤ 50 nodes) so 500 / 2000 is already an order of magnitude over.
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
      "Data for flow diagram chart, such as, { nodes: [{ name: 'node1' }, { name: 'node2' }], edges: [{ source: 'node1', target: 'node2', name: 'edge1' }] }.",
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

// Flow diagram tool descriptor
const tool = {
  name: "generate_flow_diagram",
  description:
    "Generate a flow diagram chart to show the steps and decision points of a process or system, such as, scenarios requiring linear process presentation.",
  inputSchema: zodToJsonSchema(schema),
  annotations: {
    title: "Generate Flow Diagram",
    readOnlyHint: true,
  },
};

export const flowDiagram = {
  schema,
  tool,
};
