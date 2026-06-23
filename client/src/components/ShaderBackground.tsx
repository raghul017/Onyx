// =============================================================================
// ShaderBackground — animated WebGL gradient sphere (ShaderGradient + R3F)
// =============================================================================

import { Suspense } from "react";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

export default function ShaderBackground() {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden">
            <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
                <ShaderGradientCanvas
                    style={{ width: "100%", height: "100%" }}
                    pointerEvents="none"
                >
                    <ShaderGradient
                        animate="on"
                        brightness={0.8}
                        cAzimuthAngle={270}
                        cDistance={0.5}
                        cPolarAngle={180}
                        cameraZoom={15.09}
                        color1="#73bfc4"
                        color2="#ff810a"
                        color3="#8da0ce"
                        envPreset="city"
                        grain="on"
                        lightType="env"
                        positionX={-0.1}
                        positionY={0}
                        positionZ={0}
                        reflection={0.4}
                        rotationX={0}
                        rotationY={130}
                        rotationZ={70}
                        type="sphere"
                        uAmplitude={3.2}
                        uDensity={0.8}
                        uFrequency={5.5}
                        uSpeed={0.3}
                        uStrength={0.3}
                        uTime={0}
                        wireframe={false}
                    />
                </ShaderGradientCanvas>
            </Suspense>
        </div>
    );
}
