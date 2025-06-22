import { useState, useEffect } from 'react';
import { ArrowRight, Zap, CheckCircle, Package, Shuffle, BarChartBig } from 'lucide-react'; // Changed icons for more "tool" feel
import AnimatedWarehouseGrid from '../components/layout/animatedWarehouseGrid'; // Import the new component
import { useNavigate } from 'react-router-dom';

export default function WarehouseLanding() {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/create-shop');
  };

  useEffect(() => {
    // Staggered visibility for elements
    const timer = setTimeout(() => setIsVisible(true), 100); // Slight delay for initial load
    return () => clearTimeout(timer);
  }, []);

  const features = [
    { icon: <Shuffle className="w-6 h-6" />, title: "Optimal Picking Routes", desc: "Minimize travel with AI-powered pathfinding." },
    { icon: <BarChartBig className="w-6 h-6" />, title: "Performance Insights", desc: "Track efficiency and identify bottlenecks." },
    { icon: <Package className="w-6 h-6" />, title: "Dynamic Layout Simulation", desc: "Model and test different warehouse setups." }
  ];

  const benefits = [
    "Reduce picking time significantly",
    "Decrease operational costs",
    "Improve order fulfillment speed",
    "Enhance worker productivity"
  ];

  return (
    <div className="min-h-screen w-screen bg-slate-900 text-white overflow-x-hidden"> {/* Changed bg, overflow-x */}
      
      {/* Subtle Animated background elements - Toned Down */}
      <div className="absolute inset-0 opacity-[0.03]"> {/* Reduced opacity */}
        {[...Array(15)].map((_, i) => ( // Reduced count
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" // Slightly smaller
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      {/* Main Content Area */}
      <main className="relative h-full w-full flex flex-col items-center justify-center px-4 py-16 sm:py-24 lg:py-0"> {/* Allow vertical scroll if content overflows on small screens */}
        <div className="max-w-6xl w-full mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* Left Content */}
          <div className={`space-y-6 sm:space-y-8 transform transition-all ease-out duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="space-y-4 sm:space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 border border-purple-500/40 rounded-full text-sm">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="font-medium text-purple-300">Warehouse Optimization Suite</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
                <span className="block text-cyan-400">Smart Routes.</span>
                <span className="block text-slate-100">Peak Efficiency.</span>
              </h1>
              
              <p className="text-lg sm:text-xl text-slate-300 max-w-lg">
                Transform your warehouse operations. Our platform visualizes optimal picking paths, analyzes performance, and helps you design more efficient layouts.
              </p>
            </div>

            <button
        onClick={handleClick}
        className="px-6 py-3 bg-blue-600 text-white rounded-2xl shadow-md hover:bg-blue-700 transition duration-200"
      >
        Create Your warehouse
      </button>
      <button
        onClick={handleClick}
        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl shadow-md hover:from-purple-600 hover:to-pink-600 transition duration-200"
      >
try it now      </button>

            <div className="pt-4 sm:pt-6 space-y-2.5">
              {benefits.map((benefit, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center gap-2.5 transform transition-all ease-out duration-700 ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-6 opacity-0'}`} 
                  style={{transitionDelay: `${200 + idx * 150}ms`}}
                >
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span className="text-slate-300 text-sm sm:text-base">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Visual - Using the new component */}
          <div className={`transform transition-all ease-out duration-1000 delay-200 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <AnimatedWarehouseGrid />
            {/* Floating elements toned down */}
            <div className="absolute -top-3 -right-3 w-6 h-6 bg-cyan-500/70 rounded-full animate-pulse opacity-50 blur-sm"></div>
            <div className="absolute -bottom-3 -left-3 w-5 h-5 bg-purple-500/70 rounded-full animate-pulse opacity-50 blur-sm"></div>
          </div>
        </div>

        {/* Features Section - Moved higher for better flow on typical screens */}
        <section className="w-full max-w-5xl mx-auto mt-24 sm:mt-32 lg:mt-40">
            <div className="text-center mb-12 sm:mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-3">Powerful Features, Simplified</h2>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">Everything you need to streamline your warehouse logistics and boost throughput.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, idx) => (
              <div 
                key={idx} 
                className={`group p-6 bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/60 hover:border-cyan-500/70 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10 transform hover:-translate-y-1.5 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`} 
                style={{transitionDelay: `${600 + idx * 100}ms`}}
              >
                <div className="p-3 inline-block bg-cyan-500/10 rounded-lg text-cyan-400 mb-4 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-lg text-slate-100 mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      
      {/* Footer (Optional simple footer) */}
      <footer className="absolute bottom-0 left-0 right-0 p-4 text-center">
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Warehouse Optimizer Pro. All rights reserved.</p>
      </footer>
    </div>
  );
}