// CustomNode.tsx
import { memo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import styled from "styled-components";

const CustomNode = ({ data, selected, className }) => {
  const [isDoubleClicked, setIsDoubleClicked] = useState(false);

  const handleDoubleClick = () => {
    setIsDoubleClicked(!isDoubleClicked);
  };

  return (
    <StyledNode
      selected={selected}
      className={className}
      onDoubleClick={handleDoubleClick}
      isDoubleClicked={isDoubleClicked} // Pass isDoubleClicked to the StyledNode
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ position: "relative" }}>
        <strong>{data.label}</strong>
        {/* <span
          style={{
            position: "absolute",
            right: "-3%",
            top: "-15%",
            fontSize: "6px",
            cursor: "pointer",
            zIndex: 10,
          }}
          onClick={(e) => {
            e.stopPropagation(); // Prevents selecting the node
            data?.onAddChild?.(); // ✅ Call the passed function
          }}
        >
          Add Children
        </span> */}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </StyledNode>
  );
};

// const StyledNode = styled.div<{
//   selected?: boolean;
//   isDoubleClicked?: boolean;
// }>`
//   padding-block: 10px;
//   padding-inline: 10px;
//   border-radius: 5px;
//   background: #f2f2f5;
//   color: #222;
//   width: 150px;
//   border: 1px solid #222;

//   .react-flow__handle {
//     background: #183b4e;
//     width: 8px;
//     height: 10px;
//     border-radius: 3px;
//   }
// `;

const StyledNode = styled.div<{
  selected?: boolean;
  isDoubleClicked?: boolean;
}>`
  padding-block: 10px;
  padding-inline: 10px;
  border-radius: 5px;
  background: #f2f2f5;
  color: #222;
  width: 150px;
  border: 1px solid ${(props) => (props.isDoubleClicked ? "#ff0072" : "#222")};
  font-size: 14px;

  .react-flow__handle {
    background: #183b4e;
    width: 8px;
    height: 10px;
    border-radius: 3px;
  }
`;

export default memo(CustomNode);
