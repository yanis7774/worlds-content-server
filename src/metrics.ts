import { IMetricsComponent } from '@well-known-components/interfaces'
import { metricDeclarations as logMetricDeclarations } from '@well-known-components/logger'
import { getDefaultHttpMetrics, validateMetricsDeclaration } from '@well-known-components/metrics'
import { metricDeclarations as theGraphMetricDeclarations } from '@well-known-components/thegraph-component'
import { metricDeclarations as pgMetricDeclarations } from '@well-known-components/pg-component'

export const metricDeclarations = {
  ...getDefaultHttpMetrics(),
  ...logMetricDeclarations,
  ...theGraphMetricDeclarations,
  ...pgMetricDeclarations,
  world_deployments_counter: {
    help: 'Count world deployments',
    type: IMetricsComponent.CounterType,
    labelNames: []
  }
}

// type assertions
validateMetricsDeclaration(metricDeclarations)
