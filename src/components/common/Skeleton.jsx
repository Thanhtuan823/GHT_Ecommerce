import './Skeleton.css';

const Skeleton = ({ width = '100%', height = '20px', borderRadius = '4px', style = {} }) => {
  return (
    <div className="skeleton-shimmer" style={{ width, height, borderRadius, ...style }}></div>
  );
};
export default Skeleton;
