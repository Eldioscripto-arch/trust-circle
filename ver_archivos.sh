#!/bin/bash
echo "=============================================="
echo "  VISOR DE ARCHIVOS DEL SISTEMA MEV HONEYGRID"
echo "=============================================="
echo ""
echo "Selecciona el archivo que deseas ver:"
echo ""

files=(
    "FlashLoanSandwichTrapV2.sol"
    "TrapFactory.sol"
    "orchestrator_multitrap.py"
    "deploy_traps_sequential.py"
    "deploy_factory.py"
    "broadcast_operator_v2_fixed.py"
    "deploy_trap_v2.py"
)

for i in "${!files[@]}"; do
    if [ -f "${files[$i]}" ]; then
        printf "%2d) %s\n" $((i+1)) "${files[$i]}"
    fi
done

echo ""
read -p "Número del archivo (o 'q' para salir): " choice

if [[ "$choice" == "q" ]]; then
    exit 0
fi

if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le ${#files[@]} ]; then
    selected="${files[$((choice-1))]}"
    if [ -f "$selected" ]; then
        echo "Mostrando: $selected"
        echo "----------------------------------------------"
        cat -n "$selected" | less
    else
        echo "Archivo no encontrado."
    fi
else
    echo "Selección inválida."
fi
