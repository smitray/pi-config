#!/bin/bash
# Check if current directory is in a Gortex-indexed repository
# Returns: "indexed" or "not-indexed"

# Check for .gortex.yaml in current or parent directories
check_gortex_yaml() {
    local dir="$PWD"
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/.gortex.yaml" ]]; then
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    return 1
}

# Check if daemon is running and repo is tracked
check_daemon_tracked() {
    if command -v gortex &>/dev/null; then
        local status
        status=$(gortex repos --json 2>/dev/null)
        if [[ $? -eq 0 ]] && echo "$status" | grep -q "\"path\":\"$PWD\"" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Main check
if check_gortex_yaml || check_daemon_tracked; then
    echo "indexed"
    exit 0
else
    echo "not-indexed"
    exit 1
fi
