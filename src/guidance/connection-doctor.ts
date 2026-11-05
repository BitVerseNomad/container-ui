import { DiagnosticsData, ContainerInfo, FixAction, Problem } from "./types";
import { invoke } from "@tauri-apps/api/core";

export interface ConnectionTestResult {
  success: boolean;
  steps: ConnectionStep[];
  error?: string;
}

export interface ConnectionStep {
  name: string;
  success: boolean;
  message: string;
  details?: string;
}

export async function testConnection(
  dockerContext: string,
  fromContainer: string,
  toContainer: string,
  toPort: number
): Promise<ConnectionTestResult> {
  const steps: ConnectionStep[] = [];

  try {
    // Step 1: Check if both containers exist and are running
    const fromInspect = await invoke('docker', {
      context: dockerContext,
      args: ['inspect', fromContainer],
      mergeStderr: false,
    });
    const toInspect = await invoke('docker', {
      context: dockerContext,
      args: ['inspect', toContainer],
      mergeStderr: false,
    });

    const from = JSON.parse(String(fromInspect))[0];
    const to = JSON.parse(String(toInspect))[0];

    if (from.State.Status !== 'running') {
      steps.push({ name: 'Source container running', success: false, message: `${fromContainer} is not running` });
      return { success: false, steps, error: 'Source container not running' };
    }
    steps.push({ name: 'Source container running', success: true, message: `${fromContainer} is running` });

    if (to.State.Status !== 'running') {
      steps.push({ name: 'Target container running', success: false, message: `${toContainer} is not running` });
      return { success: false, steps, error: 'Target container not running' };
    }
    steps.push({ name: 'Target container running', success: true, message: `${toContainer} is running` });

    // Step 2: Check shared network
    const fromNetworks = Object.keys(from.NetworkSettings.Networks || {});
    const toNetworks = Object.keys(to.NetworkSettings.Networks || {});
    const sharedNetworks = fromNetworks.filter(n => toNetworks.includes(n) && n !== 'bridge');

    if (sharedNetworks.length === 0) {
      steps.push({ 
        name: 'Shared network', 
        success: false, 
        message: 'No shared network found. Containers cannot resolve each other by name.',
        details: `From: ${fromNetworks.join(', ')}. To: ${toNetworks.join(', ')}`
      });
      
      // Offer fix: connect to shared network
      return { 
        success: false, 
        steps, 
        error: 'No shared network',
        // Fix action will be handled by UI
      };
    }
    steps.push({ 
      name: 'Shared network', 
      success: true, 
      message: `Shared network: ${sharedNetworks.join(', ')}` 
    });

    // Step 3: DNS resolution test (using helper container)
    const dnsResult = await testDNSResolution(dockerContext, fromContainer, toContainer, sharedNetworks[0]);
    steps.push(dnsResult);

    if (!dnsResult.success) {
      return { success: false, steps, error: 'DNS resolution failed' };
    }

    // Step 4: Port connectivity test
    const portResult = await testPortConnectivity(dockerContext, fromContainer, toContainer, toPort, sharedNetworks[0]);
    steps.push(portResult);

    if (!portResult.success) {
      return { success: false, steps, error: 'Port not reachable' };
    }

    return { success: true, steps };

  } catch (e) {
    steps.push({ 
      name: 'Error', 
      success: false, 
      message: `Test failed: ${e}`,
      details: String(e)
    });
    return { success: false, steps, error: String(e) };
  }
}

async function testDNSResolution(
  dockerContext: string,
  fromContainer: string,
  toContainer: string,
  network: string
): Promise<ConnectionStep> {
  try {
    // Run nslookup from source container's network
    const result = await invoke('network_probe', {
      context: dockerContext,
      from: fromContainer,
      target: toContainer,
      port: 53, // DNS port
    });
    
    const output = String(result);
    if (output.includes('Name:') || output.includes('Address:')) {
      return { 
        name: 'DNS resolution', 
        success: true, 
        message: `${toContainer} resolves from ${fromContainer}` 
      };
    }
    
    return { 
      name: 'DNS resolution', 
      success: false, 
      message: `${toContainer} does not resolve from ${fromContainer}`,
      details: output
    };
  } catch (e) {
    return { 
      name: 'DNS resolution', 
      success: false, 
      message: `DNS test failed: ${e}`,
      details: String(e)
    };
  }
}

async function testPortConnectivity(
  dockerContext: string,
  fromContainer: string,
  toContainer: string,
  port: number,
  network: string
): Promise<ConnectionStep> {
  try {
    const result = await invoke('network_probe', {
      context: dockerContext,
      from: fromContainer,
      target: toContainer,
      port: port,
    });
    
    const output = String(result);
    if (output.includes('Connected') || output.includes('open') || output.includes('succeeded')) {
      return { 
        name: `Port ${port} connectivity`, 
        success: true, 
        message: `Port ${port} is reachable on ${toContainer}` 
      };
    }
    
    return { 
      name: `Port ${port} connectivity`, 
      success: false, 
      message: `Port ${port} not reachable on ${toContainer}`,
      details: output
    };
  } catch (e) {
    return { 
      name: `Port ${port} connectivity`, 
      success: false, 
      message: `Port test failed: ${e}`,
      details: String(e)
    };
  }
}

export function detectLocalhostProblems(
  containers: ContainerInfo[],
  dockerContext: string
): Problem[] {
  const problems: Problem[] = [];

  for (const container of containers) {
    // Check env vars for localhost references
    // This would need container inspect - placeholder
  }

  return problems;
}

export function getConnectFixAction(
  fromContainer: string,
  toContainer: string,
  dockerContext: string
): FixAction {
  return {
    type: 'connect',
    label: `Connect ${fromContainer} to ${toContainer}`,
    dockerContext,
    containerName: fromContainer,
  };
}