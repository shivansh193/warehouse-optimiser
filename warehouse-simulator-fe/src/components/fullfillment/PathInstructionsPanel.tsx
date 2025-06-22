import React from 'react';
import type { MasterItem } from '../../interfaces/types'; // Assuming MasterItemType is your MasterItem interface
import { MapPin, Check, Package, ArrowRight } from 'lucide-react';

interface PickStepItem {
  masterItemId: string;
  quantityToPick: number;
}

interface PickStep {
  step: number;
  shelfId: number;
  facing: string;
  gridCoords: { x: number; y: number }; // Aisle access point
  items: PickStepItem[];
}

interface PathMetrics {
  timeSavedEstimate?: string;
  optimizedDistance?: number;
  unoptimizedDistance?: number;
  // Potentially other metrics like total picks, etc.
}

interface PathInstructionsPanelProps {
  pickSequenceSteps: PickStep[];
  metrics?: PathMetrics;
  masterItems: MasterItem[]; // To get item names
  startPoint?: { x: number; y: number }; // Optional: for first step instruction
  endPoint?: { x: number; y: number };   // Optional: for last step instruction
}

const PathInstructionsPanel: React.FC<PathInstructionsPanelProps> = ({
  pickSequenceSteps = [],
  metrics,
  masterItems,
  startPoint, // Example: { x: 0, y: 3 }
  endPoint    // Example: { x: 6, y: 3 }
}) => {
  const getItemName = (masterItemId: string) => {
    return masterItems.find(mi => mi.id === masterItemId)?.name || masterItemId;
  };

  if (!pickSequenceSteps || pickSequenceSteps.length === 0) {
    return (
      <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600 text-sm text-slate-400 text-center">
        No pick path to display. Generate a route first.
      </div>
    );
  }

  const instructions = [];
  let lastCoord = startPoint;

  // Start Instruction
  if (startPoint) {
    instructions.push({
      id: 'start',
      icon: <ArrowRight size={16} className="text-green-400"/>,
      text: `Start at Entry (Grid: ${startPoint.x},${startPoint.y})`,
      isPickLocation: false,
    });
  } else {
     instructions.push({
      id: 'start-generic',
      icon: <ArrowRight size={16} className="text-green-400"/>,
      text: `Begin Picking Sequence`,
      isPickLocation: false,
    });
  }

  pickSequenceSteps.forEach((stepData, index) => {
    let travelInstruction = "";
    if(lastCoord && (lastCoord.x !== stepData.gridCoords.x || lastCoord.y !== stepData.gridCoords.y)) {
        // Simple direction, can be enhanced
        if (stepData.gridCoords.y < lastCoord.y) travelInstruction += "Go North ";
        else if (stepData.gridCoords.y > lastCoord.y) travelInstruction += "Go South ";
        if (stepData.gridCoords.x < lastCoord.x) travelInstruction += "Go West ";
        else if (stepData.gridCoords.x > lastCoord.x) travelInstruction += "Go East ";
    }
    lastCoord = stepData.gridCoords;

    instructions.push({
        id: `pick-step-${stepData.step}`, // Use the unique step number from backend
        icon: <Package size={14} className="text-yellow-400"/>,
        text: `${travelInstruction}to Shelf ${stepData.shelfId} (Face ${stepData.facing}, Grid: ${stepData.gridCoords.x},${stepData.gridCoords.y})`,
        isPickLocation: true,
        itemsToPick: stepData.items.map(item => `${item.quantityToPick} x ${getItemName(item.masterItemId)}`).join(', '),
        // Store original step number for display
        displayStepNumber: stepData.step 
      });
    });

  // End Instruction
  if (endPoint) {
     let travelInstruction = "";
    if(lastCoord && (lastCoord.x !== endPoint.x || lastCoord.y !== endPoint.y)) {
        if (endPoint.y < lastCoord.y) travelInstruction += "Go North ";
        else if (endPoint.y > lastCoord.y) travelInstruction += "Go South ";
        if (endPoint.x < lastCoord.x) travelInstruction += "Go West ";
        else if (endPoint.x > lastCoord.x) travelInstruction += "Go East ";
    }
    instructions.push({
      id: 'end',
      icon: <Check size={16} className="text-fuchsia-400"/>,
      text: `${travelInstruction}Proceed to Exit (Grid: ${endPoint.x},${endPoint.y})`,
      isPickLocation: false,
    });
  } else {
       instructions.push({
        id: 'end-generic',
        icon: <Check size={16} className="text-fuchsia-400"/>,
        text: `End of Pick Route`,
        isPickLocation: false,
    });
  }


  return (
    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
      <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-cyan-400" /> Optimized Pick Plan
      </h3>
      {metrics?.timeSavedEstimate && (
        <div className="mb-3 p-2 bg-green-500/10 border border-green-500/30 rounded-md text-sm">
          <p className="text-green-300 font-medium">Est. Time Saved: <span className="text-green-200">{metrics.timeSavedEstimate}</span></p>
          <p className="text-xs text-slate-400">
            Optimized: {metrics.optimizedDistance ?? 'N/A'} units | Unoptimized: {metrics.unoptimizedDistance ?? 'N/A'} units
          </p>
        </div>
      )}
      <ol className="space-y-2.5 max-h-[250px] sm:max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50">
        {instructions.map((instr, index) => (
          <li key={`${instr.id}`} className="flex items-start gap-2 text-sm p-1.5 bg-slate-800/30 rounded-md">
            <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0
                            ${instr.id === 'start' ? 'bg-lime-500 text-black' : 
                              instr.id === 'end' ? 'bg-fuchsia-500' : 
                              instr.isPickLocation ? 'bg-cyan-600' : 'bg-slate-500'}`}>
                {instr.id === 'start' ? 'S' : instr.id === 'end' ? 'E' : 
                 instr.isPickLocation ? pickSequenceSteps.findIndex(s => `pick-${s.shelfId}-${s.facing}` === instr.id) + 1 : 
                 '•'}
            </div>
            <div className="flex-1">
                <span className="text-slate-200 block">{instr.text}</span>
                {(instr as any).itemsToPick && (
                    <span className="text-xs text-yellow-300 block pl-1">
                        ↳ Pick: {(instr as any).itemsToPick}
                    </span>
                )}
            </div>
          </li>
        ))}
        {instructions.length > 1 && ( // Show complete only if there were steps
            <li className="flex items-start gap-2 text-sm mt-3 pt-2 border-t border-slate-600/50">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white"/>
                </div>
                <span className="text-green-300 font-semibold">Picking Sequence Complete!</span>
            </li>
        )}
      </ol>
    </div>
  );
};

export default PathInstructionsPanel;