import json

def generate_nodes():
    """Generate exactly 2000 hierarchical nodes with 4 main branches"""
    nodes = []
    intermediate_nodes = {}
    
    # Add root node
    nodes.append({
        "id": "main",
        "name": "Main Node",
        "description": "Root of the hierarchy",
        "parent": {
            "level-1": "main"
        }
    })
    
    node_counter = 1
    
    # Generate nodes across 4 branches (level-2: 1-4)
    for branch in range(1, 5):
        # Add level-2 node (branch node)
        level2_id = str(branch)
        if level2_id not in intermediate_nodes:
            nodes.append({
                "id": level2_id,
                "name": f"Branch {branch}",
                "description": f"Branch {branch} root",
                "parent": {
                    "level-1": "main",
                    "level-2": level2_id
                }
            })
            intermediate_nodes[level2_id] = True
        
        # Target 500 nodes per branch (4 branches = 2000 total)
        nodes_per_branch = 500
        current_count = 0
        
        # Level 3: 4 children
        for level3 in range(1, 5):
            if current_count >= nodes_per_branch:
                break
                
            level3_id = f"{branch}.{level3}"
            if level3_id not in intermediate_nodes:
                nodes.append({
                    "id": level3_id,
                    "name": f"Node {level3_id}",
                    "description": f"Intermediate node {level3_id}",
                    "parent": {
                        "level-1": "main",
                        "level-2": str(branch),
                        "level-3": level3_id
                    }
                })
                intermediate_nodes[level3_id] = True
            
            # Level 4: 4 children
            for level4 in range(1, 5):
                if current_count >= nodes_per_branch:
                    break
                    
                level4_id = f"{branch}.{level3}.{level4}"
                if level4_id not in intermediate_nodes:
                    nodes.append({
                        "id": level4_id,
                        "name": f"Node {level4_id}",
                        "description": f"Intermediate node {level4_id}",
                        "parent": {
                            "level-1": "main",
                            "level-2": str(branch),
                            "level-3": level3_id,
                            "level-4": level4_id
                        }
                    })
                    intermediate_nodes[level4_id] = True
                
                # Level 5: 4 children
                for level5 in range(1, 5):
                    if current_count >= nodes_per_branch:
                        break
                    
                    level5_id = f"{branch}.{level3}.{level4}.{level5}"
                    if level5_id not in intermediate_nodes:
                        nodes.append({
                            "id": level5_id,
                            "name": f"Node {level5_id}",
                            "description": f"Intermediate node {level5_id}",
                            "parent": {
                                "level-1": "main",
                                "level-2": str(branch),
                                "level-3": level3_id,
                                "level-4": level4_id,
                                "level-5": level5_id
                            }
                        })
                        intermediate_nodes[level5_id] = True
                    
                    # Level 6: 2 children (leaf nodes)
                    for level6 in range(1, 3):
                        if current_count >= nodes_per_branch:
                            break
                        
                        node_id = f"{branch}.{level3}.{level4}.{level5}.{level6}"
                        
                        nodes.append({
                            "id": node_id,
                            "name": f"name-{1000000 + node_counter}",
                            "description": f"Description for {node_id}",
                            "parent": {
                                "level-1": "main",
                                "level-2": str(branch),
                                "level-3": level3_id,
                                "level-4": level4_id,
                                "level-5": level5_id,
                                "level-6": node_id
                            }
                        })
                        
                        node_counter += 1
                        current_count += 1
    
    return nodes

# Generate and save
data = generate_nodes()
print(f"Generated {len(data)} nodes (including intermediate nodes)")

with open('src/data.json', 'w') as f:
    json.dump(data, f, indent=2)

print("data.json file created successfully!")
