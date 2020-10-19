let {toLogicalID} = require('@architect/utils')
let getPropertyHelper = require('../get-lambda-config')
let getEnv = require('../get-lambda-env')

/**
 * visit arc.scheduled and merge in AWS::Serverless resources
 */
module.exports = function visitScheduled(arc, template) {

  // ensure cf standard sections exist
  if (!template.Resources)
    template.Resources = {}

  if (!template.Outputs)
    template.Outputs = {}

  // we leave the bucket name generation up to cloudfront
  arc.rules.forEach(rules=> {

    let code = `./src/rules/${rules[0]}`
    let name = toLogicalID(rules.shift())
    let query = rules.join(' ').trim()
    let prop = getPropertyHelper(arc, code) // helper function for getting props
    let env = getEnv(arc, code)

    template.Resources[name] = {
      Type: 'AWS::Serverless::Function',
      Properties: {
        Handler: 'index.handler',
        CodeUri: code,
        Runtime: prop('runtime'),
        MemorySize: prop('memory'),
        Timeout: prop('timeout'),
        Environment: {Variables: env},
        Role: {
          'Fn::Sub': [
            'arn:aws:iam::${AWS::AccountId}:role/${roleName}',
            {roleName: {'Ref': `Role`}}
          ]
        },
        Events: {}
      }
    }

    let concurrency = prop('concurrency')
    if (concurrency != 'unthrottled') {
      template.Resources[name].Properties.ReservedConcurrentExecutions = concurrency
    }

    let layers = prop('layers')
    if (Array.isArray(layers) && layers.length > 0) {
      template.Resources[name].Properties.Layers = layers
    }

    let policies = prop('policies')
    if (Array.isArray(policies) && policies.length > 0) {
      template.Resources[name].Properties.Policies = policies
    }

    // construct the event source so SAM can wire the permissions
    template.Resources[name].Properties.Events[`${name}Event`] = {
      Type: 'IoTRule',
      Properties: {
        AwsIotSqlVersion: '2016-03-23',
        Sql: query
      }
    }
  })

  return template
}
